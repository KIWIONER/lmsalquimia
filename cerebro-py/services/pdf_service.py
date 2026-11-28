import re
from collections import Counter
import httpx
import pymupdf
import pymupdf4llm
from typing import List, Dict, Any

from services.pdf_cleaner import clean_unicode_artifacts, is_non_pedagogical_page
from services.translator import translate_gl_to_es


def clean_card_title(raw: str, default_title: str) -> str:
    cleaned = re.sub(r"</?(?:u|b|i|strong|em|mark|span|sub|sup|small|font)(?:\s[^>]*)?>", "", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"^[-*#\s_•]+", "", cleaned)
    cleaned = re.sub(r"[-*#\s_:•]+$", "", cleaned).strip()
    if not cleaned:
        return default_title

    # Si está en MAYÚSCULAS sostenidas (> 4 letras), pasar a formato legible
    letters = [c for c in cleaned if c.isalpha()]
    if len(letters) >= 4 and cleaned == cleaned.upper():
        words = cleaned.split()
        normalized_words = []
        keep_upper = {"ADN", "ARN", "ATP", "OMS", "FAO", "UE", "PH", "UD1", "UD2", "UD3", "UD4", "UD5", "UD6", "UD7", "UD8", "UD9"}
        for idx, w in enumerate(words):
            w_clean = re.sub(r"[^A-ZÁÉÍÓÚÑÜ0-9]", "", w)
            if w_clean in keep_upper or re.fullmatch(r"UD\d+([.-]\d+)?", w_clean):
                normalized_words.append(w)
            elif idx == 0:
                normalized_words.append(w.capitalize())
            else:
                normalized_words.append(w.lower())
        cleaned = " ".join(normalized_words)

    return cleaned[:100]


def _numbering_depth(title: str) -> int:
    m = re.match(r"^(\d+(?:\.\d+)*)\.?(\s+)", title.strip())
    if m:
        return len(m.group(1).split("."))
    if re.match(r"^[IVXLCDM]+\.\s+", title.strip()):
        return 1
    return 0


def _has_numbering(title: str) -> bool:
    return _numbering_depth(title) > 0


def _is_heading_line(line: str) -> bool:
    s = line.strip()
    if not s or len(s) > 90:
        return False
    # Las viñetas de lista nunca son encabezados de tarjeta independiente
    if re.match(r"^(?:[-*•]\s+|>)", s):
        return False
    # 1. Markdown header (# Título)
    if re.match(r"^#{1,4}\s+\S", s):
        return True
    # 2. Línea independiente en negrita (**Título**) sin ser una frase larga
    if re.match(r"^\*\*[^*]{3,75}\*\*$", s) and not s.endswith("."):
        return True
    # 3. Epígrafe numerado jerárquico (ej. "2.3. Atmósfera gaseosa", "1.2 Factores", "II. Normas")
    if re.match(r"^(?:\d+(?:\.\d+)+\.?|\d+\.)\s+[A-ZÁÉÍÓÚÑ]", s) and not s.endswith("."):
        return True
    if re.match(r"^[IVXLCDM]+\.\s+[A-ZÁÉÍÓÚÑ]", s) and not s.endswith("."):
        return True
    # 4. Todo en mayúsculas (4..70 chars, con letras, sin punto final)
    letters = [c for c in s if c.isalpha()]
    if len(letters) >= 4 and s == s.upper() and not s.endswith((".", ";", ",")):
        return True
    # 4. Epígrafe corto terminado en ':' (1 a 5 palabras, sin empezar por viñeta)
    if s.endswith(":") and not s.startswith(("-", "*", "•", ">")) and 1 <= len(s.split()) <= 5:
        return True
    return False


def _strip_repeated_headers_footers(pages_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Elimina cabeceras/pies repetidos entre páginas y números sueltos de página."""
    if len(pages_data) <= 1:
        return pages_data

    edge_counter: Counter = Counter()
    for page in pages_data:
        lines = [ln.strip() for ln in page.get("text", "").splitlines() if ln.strip()]
        for ln in lines[:2] + lines[-2:]:
            if len(ln) <= 80:
                edge_counter[ln] += 1

    repeated = {ln for ln, count in edge_counter.items() if count >= 2}
    cleaned_pages: List[Dict[str, Any]] = []

    for page in pages_data:
        raw_lines = page.get("text", "").splitlines()
        kept: List[str] = []
        for idx, raw_ln in enumerate(raw_lines):
            s = raw_ln.strip()
            # Número de página suelto al principio o final
            if re.fullmatch(r"\d{1,3}", s) and (idx < 3 or idx >= len(raw_lines) - 3):
                continue
            if s in repeated:
                continue
            # Cabeceras típicas tipo "UD1 ← ..." o "UD1 -> ..."
            if re.match(r"^UD\s*\d+\s*[←→\-–]", s, re.IGNORECASE):
                continue
            kept.append(raw_ln)
        cleaned_pages.append({
            "metadata": page.get("metadata", {}),
            "text": "\n".join(kept),
        })

    return cleaned_pages


async def process_pdf_from_url(pdf_url: str) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(pdf_url)
        if res.status_code != 200:
            raise ValueError(f"No se pudo descargar el PDF de Storage: HTTP {res.status_code}")
        pdf_bytes = res.content

    return extract_cards_from_pdf_bytes(pdf_bytes)


def _normalize_section_bullet_indentation(body: str) -> str:
    """Preserva la indentación de párrafos y sub-viñetas bajo viñetas de epígrafe ('- **Título:**')."""
    lines = body.splitlines()
    out: List[str] = []
    in_section_bullet = False
    prev_was_bullet = False

    section_bullet_re = re.compile(r"^- \*\*[^*]{2,80}:\*\*\s*$")

    for raw in lines:
        stripped = raw.strip()
        if not stripped:
            out.append("")
            continue

        if re.match(r"^#{1,6}\s+", stripped):
            in_section_bullet = False
            prev_was_bullet = False
            out.append(stripped)
            continue

        if section_bullet_re.match(stripped):
            in_section_bullet = True
            prev_was_bullet = True
            out.append(stripped)
            continue

        is_indented_bullet = bool(re.match(r"^\s+[-*•]\s+", raw))
        is_flat_bullet = bool(re.match(r"^[-*•]\s+", stripped)) and not is_indented_bullet

        if in_section_bullet:
            if is_indented_bullet:
                content = re.sub(r"^\s+[-*•]\s+", "", raw).strip()
                out.append(f"    - {content}")
                prev_was_bullet = True
            elif is_flat_bullet:
                content = re.sub(r"^[-*•]\s+", "", stripped)
                out.append(f"  - {content}")
                prev_was_bullet = True
            elif stripped.startswith("|") or stripped.startswith(">"):
                in_section_bullet = False
                prev_was_bullet = False
                out.append(raw)
            else:
                out.append(f"  {stripped}")
                prev_was_bullet = False
        else:
            if is_indented_bullet and not prev_was_bullet:
                content = re.sub(r"^\s+[-*•]\s+", "", raw).strip()
                out.append(f"- {content}")
                prev_was_bullet = True
            elif is_indented_bullet:
                content = re.sub(r"^\s+[-*•]\s+", "", raw).strip()
                out.append(f"  - {content}")
                prev_was_bullet = True
            elif is_flat_bullet:
                content = re.sub(r"^[-*•]\s+", "", stripped)
                out.append(f"- {content}")
                prev_was_bullet = True
            else:
                out.append(raw)
                prev_was_bullet = False

    return "\n".join(out).strip()


def extract_cards_from_pdf_bytes(
    pdf_bytes: bytes,
    translate_to_es: bool = False,
) -> List[Dict[str, Any]]:
    """
    Extrae tarjetas estructuradas en Markdown desde los bytes de un PDF usando PyMuPDF.
    - Elimina cabeceras/pies repetidos y números de página.
    - Agrupa contenido continuo entre saltos de página bajo su epígrafe real
      (evitando tarjetas huérfanas tipo 'Página X - Tema Y').
    - Opcionalmente normaliza gallego -> castellano mediante translator.py.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    raw_pages = pymupdf4llm.to_markdown(doc, page_chunks=True)
    pages_data = _strip_repeated_headers_footers(raw_pages)

    sections: List[Dict[str, Any]] = []
    current: Dict[str, Any] | None = None

    for page_idx, page_item in enumerate(pages_data, start=1):
        meta = page_item.get("metadata", {})
        page_num = int(meta.get("page_number") or page_idx)
        text = clean_unicode_artifacts(page_item.get("text", "")).strip()
        if not text:
            continue
        if page_num <= 2 and is_non_pedagogical_page(text):
            continue

        for line in text.splitlines():
            # Normalizar cualquier sub-lista (1..N espacios) a exactamente 2 espacios ('  - ')
            # Importante: 4+ espacios tras línea en blanco en CommonMark/TipTap crea <pre><code> que desborda la tarjeta
            if re.match(r"^\s+[-*•]\s+", line):
                line = re.sub(r"^\s+[-*•]\s+", "  - ", line)
            # Despegar viñetas inline tipo '] - **Fecha' o '. - **Fecha'
            line = re.sub(r"([\]\.\)])\s+-\s+(\*\*)", r"\1\n- \2", line)
            stripped = line.strip()
            # Ignorar viñetas vacías o líneas que solo tienen puntuación/comillas sueltas (ej. '- "')
            if re.fullmatch(r'[-*•"\'.,;:]+', stripped) or re.fullmatch(r'[-*•]\s*["\'.,;:]+', stripped):
                continue

            # Si estamos dentro de la tarjeta de Índice/Contenidos en la misma página donde empezó,
            # no partir el índice por sus propios sub-epígrafes.
            in_toc_card = (
                current is not None
                and page_num == current["pagina"]
                and bool(re.search(r'\b(contenidos?|índice|indice|sumario|tabla de contenidos?)\b', current["titulo"], re.IGNORECASE))
            )
            if in_toc_card:
                current["lines"].append(line)
                continue

            if _is_heading_line(stripped):
                title = clean_card_title(stripped, "Sección")
                current_body = "\n".join(current["lines"]).strip() if current is not None else ""
                if current is not None and not current_body:
                    cur_depth = _numbering_depth(current["titulo"])
                    new_depth = _numbering_depth(title)
                    # Conservar el título padre (ej. '2. Vida útil...') y bajar sub-epígrafe/subtítulo al cuerpo
                    if cur_depth > 0 and (new_depth == 0 or new_depth > cur_depth):
                        current["lines"].append(f"### {title}")
                    else:
                        current["titulo"] = title
                elif current is not None and len(current_body) < 60:
                    # Evitar tarjetas huérfanas de 1 línea: absorber el siguiente epígrafe como subtítulo
                    current["lines"].append("")
                    current["lines"].append(f"### {title}")
                else:
                    if current is not None and len(current_body) >= 20:
                        sections.append(current)
                    current = {
                        "titulo": title,
                        "lines": [],
                        "pagina": page_num,
                    }
            else:
                if current is None:
                    if not stripped:
                        continue
                    current = {
                        "titulo": "Introducción",
                        "lines": [line],
                        "pagina": page_num,
                    }
                else:
                    current["lines"].append(line)

    if current is not None and len("\n".join(current["lines"]).strip()) >= 20:
        sections.append(current)

    cards: List[Dict[str, Any]] = []
    for idx, sec in enumerate(sections):
        body = "\n".join(sec["lines"]).strip()
        # Colapsar múltiples saltos de línea excesivos y pegar sub-viñetas (2 espacios) a su ítem padre
        body = re.sub(r"\n{3,}", "\n\n", body)
        body = re.sub(r"\n{2,}(  - )", r"\n\1", body)
        # Limpiar cualquier viñeta vacía residual y tags <mark> de resaltado PDF
        body = re.sub(r"</?mark(?:\s[^>]*)?>", "", body, flags=re.IGNORECASE)
        body = re.sub(r"(?m)^\s*[-*•]\s*$\n?", "", body).strip()
        body = _normalize_section_bullet_indentation(body)
        title = sec["titulo"]

        if translate_to_es:
            title = clean_card_title(translate_gl_to_es(title), title)
            body = translate_gl_to_es(body)

        cards.append({
            "titulo": title[:100],
            "contenido": body,
            "orden": idx,
            "pagina": sec["pagina"],
        })

    return cards
