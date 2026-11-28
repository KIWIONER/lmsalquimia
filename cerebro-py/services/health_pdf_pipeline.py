"""
Pipeline de 4 Capas para Ingesta Fiable de PDFs de Salud:
  Capa 1: Extracción literal determinista (PyMuPDF + limpieza de cabeceras/pies).
  Capa 2: Filtro previo de idioma (fast-path castellano) + estructuración por LLM Router
          con concurrencia controlada (asyncio.Semaphore) y aislamiento XML.
  Capa 3: Validación Numérica Bidireccional (guardrails.py) con fail-safe a texto literal.
  Capa 4: Progreso en tiempo real + reporte de verificación para revisión en /admin.
"""
import asyncio
import inspect
import re
import time
from typing import Any, Callable, Dict, List, Optional

from schemas.llm import LLMRouterRequest, StructuredCardOutput
from services.guardrails import (
    detect_prompt_injection,
    validate_bidirectional_numerical_integrity,
)
from services.llm_router import LLMRouter, create_router_for_mode
from services.pdf_cleaner import clean_unicode_artifacts
from services.pdf_service import clean_card_title, extract_cards_from_pdf_bytes

SYSTEM_PROMPT_CARD_STRUCTURER = (
    "Eres un editor científico y sanitario riguroso. "
    "Tu única tarea es traducir al castellano natural (si el origen está en gallego u otro idioma) "
    "y limpiar el formato Markdown y el título de la tarjeta pedagógica recibida dentro de <documento_fuente>. "
    "REGLAS INQUEBRANTABLES:\n"
    "1. NO resumas, NO omitas información y NO inventes datos.\n"
    "2. Conserva EXACTAMENTE todas las cifras, porcentajes, temperaturas, dosis y unidades (mg, µg, kcal, °C, %, UI, etc.).\n"
    "3. Devuelve un título breve, claro y profesional en castellano (sin dos puntos al final ni todo en mayúsculas), CONSERVANDO SIEMPRE la numeración jerárquica original del epígrafe si la tiene (ej. '2.3. Atmósfera gaseosa', '1.1. Concepto', 'II. Normas').\n"
    "4. PROHIBIDO convertir listas en un párrafo corrido: conserva CADA viñeta ('- ') y sub-viñeta ('  - ' con exactamente 2 espacios, nunca 4) en su propia línea usando saltos de línea \\n.\n"
    "5. Responde EXCLUSIVAMENTE con un objeto JSON válido con las claves: "
    '{"titulo": "...", "contenido_markdown": "..."}.'
)

# Marcadores inequívocos de gallego (sin falsos positivos con 'no', 'dos', 'da', 'segundo' en castellano)
_GALICIAN_OR_DIRTY_PATTERN = re.compile(
    r"(?:"
    r"\b(?:unha|unhas|algúns|algunhas|moitos|moitas|outros|outras|"
    r"tamén|ademais|mentres|cando|máis|polo|pola|polos|polas|dun|dunha|"
    r"auga|augas|graxa|graxas|graxo|graxos|inxesta|enerxía|enerxético|enerxética|"
    r"doenza|doenzas|saúde|persoas|doado|doada|xeral|xerais|temos|pódese|"
    r"dixestión|bromatoloxía|aparello|obxectivos|crecemento|fungos|baixo|baixa|"
    r"consecuencia\s+da|estudo\s+dos|alimentos\s+e|nutrición\s+e|hixiene|seguridade|traballo|prevención\s+de)\b"
    r"|lóx|xest|cións\b"
    r")",
    re.IGNORECASE,
)

ProgressCallback = Callable[[int, int, str, str, float], Any]


def is_already_clean_spanish(title: str, body: str) -> bool:
    """
    Determina de forma conservadora si una tarjeta ya está en castellano limpio
    y no necesita pasar por el LLM (ahorra tiempo y tokens manteniendo el diff numérico).
    """
    combined = f"{title}\n{body}".strip()
    if not combined:
        return False
    # Si el título sigue todo en mayúsculas, conviene normalizarlo
    letters = [c for c in title if c.isalpha()]
    if len(letters) >= 5 and title == title.upper():
        return False
    if _GALICIAN_OR_DIRTY_PATTERN.search(combined):
        return False
    return True


async def _notify_progress(
    cb: Optional[ProgressCallback],
    completed: int,
    total: int,
    title: str,
    status: str,
    elapsed_s: float,
) -> None:
    if cb is None:
        return
    res = cb(completed, total, title, status, elapsed_s)
    if inspect.isawaitable(res):
        await res


async def process_pdf_with_4_layers(
    pdf_bytes: bytes,
    mode: Optional[str] = None,
    router: Optional[LLMRouter] = None,
    max_concurrency: Optional[int] = None,
    on_progress: Optional[ProgressCallback] = None,
    enable_language_fast_path: bool = True,
) -> Dict[str, Any]:
    """Ejecuta las Capas 1-4 sobre un PDF con concurrencia controlada y progreso en tiempo real."""
    t0 = time.perf_counter()

    # Capa 1: Extracción literal determinista
    raw_cards = extract_cards_from_pdf_bytes(pdf_bytes, translate_to_es=False)
    active_router = router or create_router_for_mode(mode=mode)
    effective_mode = (mode or ("local_gpu" if active_router.primary_provider == "local_gpu" else "prod_api")).lower()

    if max_concurrency is None:
        concurrency = 1 if effective_mode == "local_gpu" else 6
    else:
        concurrency = max(1, max_concurrency)

    total_cards = len(raw_cards)
    semaphore = asyncio.Semaphore(concurrency)
    progress_lock = asyncio.Lock()
    completed_counter = 0

    async def _process_one(idx: int, raw: Dict[str, Any]) -> Dict[str, Any]:
        nonlocal completed_counter
        card_t0 = time.perf_counter()

        raw_title = clean_card_title(str(raw.get("titulo", f"Sección {idx + 1}")), f"Sección {idx + 1}")
        raw_body = clean_unicode_artifacts(str(raw.get("contenido", "")).strip())
        source_combined = f"{raw_title}\n{raw_body}"
        page_num = int(raw.get("pagina", 1))

        result_card: Dict[str, Any]
        status_label = "OK"

        # Capa 2A: Defensa contra Prompt Injection en el PDF
        if detect_prompt_injection(source_combined):
            status_label = "BLOCKED_INJECTION"
            result_card = {
                "titulo": raw_title,
                "contenido": raw_body,
                "orden": idx,
                "pagina": page_num,
                "needs_review": True,
                "review_notes": {
                    "reason": "prompt_injection_detected",
                    "missing_in_output": [],
                    "invented_in_output": [],
                },
            }
        # Capa 2B: Fast-path si ya está en castellano limpio (evita llamada innecesaria al LLM)
        elif enable_language_fast_path and is_already_clean_spanish(raw_title, raw_body):
            diff = validate_bidirectional_numerical_integrity(source_combined, source_combined)
            status_label = "FAST_PATH_ES"
            result_card = {
                "titulo": raw_title,
                "contenido": raw_body,
                "orden": idx,
                "pagina": page_num,
                "needs_review": False,
                "review_notes": {
                    "reason": "fast_path_already_spanish",
                    "source_dosages": diff["source_dosages"],
                },
            }
        else:
            # Capa 2C: Estructuración / Traducción con LLM Router bajo Semáforo
            prompt = (
                "Transforma el siguiente fragmento del documento original en JSON válido:\n"
                f"<documento_fuente>\nTítulo original: {raw_title}\n\n{raw_body}\n</documento_fuente>"
            )
            req = LLMRouterRequest(
                prompt=prompt,
                system_prompt=SYSTEM_PROMPT_CARD_STRUCTURER,
                source_context=source_combined,
                feature="card_structure",
                temperature=0.0,
                max_tokens=2048,
            )

            async with semaphore:
                try:
                    resp = await active_router.generate(req, response_schema=StructuredCardOutput)

                    if not resp.schema_valid or not resp.parsed_json:
                        status_label = "FALLBACK_SCHEMA"
                        result_card = {
                            "titulo": raw_title,
                            "contenido": raw_body,
                            "orden": idx,
                            "pagina": page_num,
                            "needs_review": True,
                            "review_notes": {
                                "reason": "schema_validation_failed_fallback_literal",
                                "missing_in_output": [],
                                "invented_in_output": [],
                            },
                        }
                    else:
                        out_title = clean_card_title(resp.parsed_json["titulo"], raw_title)
                        out_body = clean_unicode_artifacts(str(resp.parsed_json["contenido_markdown"]).strip())

                        # Capa 3: Diff Numérico Bidireccional + Guardrail estructural de listas
                        src_bullets = len(re.findall(r"^\s*[-*]\s+", raw_body, re.MULTILINE))
                        out_bullets = len(re.findall(r"^\s*[-*]\s+", out_body, re.MULTILINE))
                        lost_list_structure = src_bullets >= 3 and out_bullets == 0

                        diff = validate_bidirectional_numerical_integrity(
                            source_combined, f"{out_title}\n{out_body}"
                        )
                        if not diff["ok"] or lost_list_structure:
                            status_label = "NEEDS_REVIEW"
                            reason = "numerical_diff_mismatch" if not diff["ok"] else "list_structure_collapsed"
                            result_card = {
                                "titulo": out_title,
                                "contenido": out_body,
                                "orden": idx,
                                "pagina": page_num,
                                "needs_review": True,
                                "review_notes": {
                                    "reason": reason,
                                    "missing_in_output": diff["missing_in_output"],
                                    "invented_in_output": diff["invented_in_output"],
                                    "errors": diff["errors"],
                                    "src_bullets": src_bullets,
                                    "out_bullets": out_bullets,
                                },
                            }
                        else:
                            status_label = "OK"
                            result_card = {
                                "titulo": out_title,
                                "contenido": out_body,
                                "orden": idx,
                                "pagina": page_num,
                                "needs_review": False,
                                "review_notes": {
                                    "reason": "verified",
                                    "source_dosages": diff["source_dosages"],
                                },
                            }
                except Exception as exc:
                    status_label = "FALLBACK_ERROR"
                    result_card = {
                        "titulo": raw_title,
                        "contenido": raw_body,
                        "orden": idx,
                        "pagina": page_num,
                        "needs_review": True,
                        "review_notes": {
                            "reason": f"llm_error_fallback_literal: {str(exc)[:160]}",
                            "missing_in_output": [],
                            "invented_in_output": [],
                        },
                    }

        elapsed_s = round(time.perf_counter() - card_t0, 2)
        async with progress_lock:
            completed_counter += 1
            await _notify_progress(
                on_progress,
                completed_counter,
                total_cards,
                result_card["titulo"],
                status_label,
                elapsed_s,
            )

        return result_card

    processed_cards = list(
        await asyncio.gather(*[_process_one(i, raw) for i, raw in enumerate(raw_cards)])
    )

    verified_count = sum(1 for c in processed_cards if not c.get("needs_review"))
    review_count = sum(1 for c in processed_cards if c.get("needs_review"))
    fast_path_count = sum(
        1 for c in processed_cards if c.get("review_notes", {}).get("reason") == "fast_path_already_spanish"
    )
    total_latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "cards": processed_cards,
        "verification_report": {
            "total_cards": len(processed_cards),
            "verified_cards": verified_count,
            "needs_review_cards": review_count,
            "fast_path_skipped_llm": fast_path_count,
            "max_concurrency": concurrency,
            "all_numbers_preserved": review_count == 0,
            "mode": effective_mode,
            "model_used": active_router.primary_model,
            "total_latency_ms": total_latency_ms,
        },
    }
