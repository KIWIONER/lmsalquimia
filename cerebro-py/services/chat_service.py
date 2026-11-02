import json
import asyncio
import httpx
from typing import AsyncGenerator, Dict, Any
from config import N8N_CEREBRO_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Accept-Profile": "nutricionista"
}

async def stream_n8n_or_fallback(query: str, session_id: str = "default") -> AsyncGenerator[str, None]:
    payload = {
        "chatInput": query,
        "query": query,
        "sessionId": session_id,
        "timestamp": ""
    }

    n8n_done = False
    try:
        # Intentar conectar con n8n con timeout ágil de 3.5 segundos
        async with httpx.AsyncClient(timeout=3.5) as client:
            resp = await client.post(N8N_CEREBRO_URL, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                text = data.get("response") or data.get("output") or data.get("text") or ""
                if text:
                    n8n_done = True
                    words = text.split(" ")
                    for i in range(0, len(words), 3):
                        chunk = " ".join(words[i:i+3]) + " "
                        yield f"data: {json.dumps({"token": chunk})}\n\n"
                        await asyncio.sleep(0.02)
                    yield "data: [DONE]\n\n"
                    return
    except Exception as e:
        print(f"n8n no respondió en 3.5s ({e}). Activando respuesta clínica inmediata...")

    if not n8n_done:
        # Fallback clínico inmediato: buscar contexto real en tarjetas de Supabase
        context_text = ""
        try:
            words = [w.lower() for w in query.replace("?", "").replace("¿", "").split() if len(w) > 3]
            kw = words[0] if words else "nutricion"
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(
                    f"{SUPABASE_URL}/rest/v1/tarjetas?contenido=ilike.*{kw}*&select=titulo,contenido&limit=2",
                    headers=HEADERS
                )
                if res.status_code == 200 and res.json():
                    items = res.json()
                    context_text = " ".join([i.get("contenido", "")[:220] for i in items])
        except Exception:
            pass

        greeting = (
            "¡Hola! Como Profesor de Alquimia, abordo tu consulta desde el rigor de la bioquímica nutricional y la dietoterapia. "
        )
        body = (
            f"En relación a tu pregunta sobre «{query.strip()}», debemos considerar que el metabolismo energético humano "
            "depende del balance estricto entre el Gasto Energético Total (GET), el Gasto Energético Basal (GEB) y el efecto termogénico de los alimentos. "
        )
        if context_text:
            body += f"En nuestros módulos didácticos se especifica: «{context_text.strip()}». "
        advice = (
            "\n\n💡 **Gema de Sabiduría:** Recuerda que la adaptación nutricional óptima prioriza la masa metabólica activa (masa magra) "
            "y la preservación de la homeostasis tisular. ¿Quieres repasar la tarjeta de esta lección o hacer una auto-evaluación?"
        )

        full_response = greeting + body + advice
        words = full_response.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i+3]) + " "
            yield f"data: {json.dumps({"token": chunk})}\n\n"
            await asyncio.sleep(0.02)

        yield "data: [DONE]\n\n"
