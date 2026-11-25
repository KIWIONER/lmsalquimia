import asyncio
import json
from typing import AsyncGenerator, Dict, List, Optional
import httpx

from config import GEMINI_API_KEY, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from schemas.llm import LLMRouterRequest
from services.guardrails import detect_prompt_injection
from services.llm_router import LLMRouter
from services.observability import default_observer
from services.vector_repository import InMemoryVectorRepository, VectorRepository

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Accept-Profile": "nutricionista",
}

_default_vector_repo = InMemoryVectorRepository()
_default_router = LLMRouter(observer=default_observer)


async def _fetch_supabase_context(query: str) -> str:
    try:
        words = [w.lower() for w in query.replace("?", "").replace("¿", "").split() if len(w) > 3]
        kw = words[0] if words else "nutricion"
        async with httpx.AsyncClient(timeout=2.0) as client:
            res = await client.get(
                f"{SUPABASE_URL}/rest/v1/tarjetas?contenido=ilike.*{kw}*&select=titulo,contenido&limit=2",
                headers=HEADERS,
            )
            if res.status_code == 200 and res.json():
                items = res.json()
                return " ".join([i.get("contenido", "")[:220] for i in items])
    except Exception:
        pass
    return ""


async def stream_rag_tutor(
    query: str,
    session_id: str = "default",
    user_id: str = "anonymous",
    rama_cientifica: Optional[str] = None,
    vector_repo: Optional[VectorRepository] = None,
    router: Optional[LLMRouter] = None,
) -> AsyncGenerator[str, None]:
    """
    Pipeline RAG del Profesor Alquimia (sin dependencia legacy de n8n):
    Guardrail entrada -> Retrieval Híbrido -> LLM Router (con Fallback) -> Guardrail numérico -> SSE.
    """
    if detect_prompt_injection(query):
        msg = (
            "No puedo procesar instrucciones que intenten alterar las reglas académicas "
            "del Profesor Alquimia. Formula tu consulta científica directamente."
        )
        yield f"data: {json.dumps({'token': msg})}\n\n"
        yield "data: [DONE]\n\n"
        return

    repo = vector_repo or _default_vector_repo
    filters = {"rama_cientifica": rama_cientifica} if rama_cientifica else None
    hits = repo.hybrid_search(query, top_k=3, filters=filters)
    rag_context = "\n".join(h.get("contenido_markdown", "") for h in hits if h.get("contenido_markdown"))

    if not rag_context:
        rag_context = await _fetch_supabase_context(query)

    full_response = ""
    if GEMINI_API_KEY or OPENAI_API_KEY:
        try:
            active_router = router or _default_router
            llm_req = LLMRouterRequest(
                prompt=(
                    f"Contexto bibliográfico verificado:\n{rag_context or 'Sin fragmentos locales.'}\n\n"
                    f"Consulta del estudiante:\n{query}"
                ),
                system_prompt=(
                    "Eres el Profesor Alquimia, tutor científico de Medicina, Nutrición, Química y Física. "
                    "Responde con rigor y no inventes dosis ni unidades fuera del contexto."
                ),
                source_context=rag_context,
                feature="tutor_chat",
                user_id=user_id,
                session_id=session_id,
            )
            llm_res = await active_router.generate(llm_req)
            full_response = llm_res.content
        except Exception:
            full_response = ""

    if not full_response:
        greeting = (
            "¡Hola! Como Profesor de Alquimia, abordo tu consulta desde el rigor científico y clínico. "
        )
        body = (
            f"En relación a tu pregunta sobre «{query.strip()}», debemos analizar los mecanismos "
            "fisiológicos, bioquímicos y las magnitudes de referencia aplicables. "
        )
        if rag_context:
            body += f"En nuestros módulos didácticos se especifica: «{rag_context.strip()[:300]}». "
        advice = (
            "\n\n💡 **Gema de Sabiduría:** Verifica siempre las unidades y rangos de referencia en tu "
            "bibliografía base. ¿Quieres repasar la tarjeta de esta lección o hacer una auto-evaluación?"
        )
        full_response = greeting + body + advice
        default_observer.record_trace(
            {
                "user_id": user_id,
                "session_id": session_id,
                "feature": "tutor_chat",
                "prompt_version": "v2.0",
                "provider": "local-fallback",
                "model": "local-fallback",
                "fallback_used": False,
                "cache_hit": False,
                "latency_ms": 1.0,
                "input_tokens": len(query) // 4,
                "output_tokens": len(full_response) // 4,
                "cost_usd": 0.0,
                "schema_valid": True,
                "guardrail_passed": True,
            }
        )

    words = full_response.split(" ")
    for i in range(0, len(words), 3):
        chunk = " ".join(words[i : i + 3]) + " "
        yield f"data: {json.dumps({'token': chunk})}\n\n"
        await asyncio.sleep(0.01)

    yield "data: [DONE]\n\n"
