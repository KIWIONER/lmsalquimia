import os
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from schemas.quiz import QuizGenerationRequest, QuizGenerationResponse
from services.quiz_service import generate_adaptive_quiz
from services.pdf_service import process_pdf_from_url
from services.chat_service import stream_rag_tutor
from config import HOST, PORT

app = FastAPI(
    title="Cerebro Python Core - LMS Alquimia",
    description="Microservicio de alto rendimiento para IA, Quizzes y Procesamiento de PDFs",
    version="1.0.0"
)

# Permitir CORS únicamente para el loopback y frontend de Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002"
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "cerebro-py",
        "version": "1.0.0",
        "modules": ["quiz_generator", "pdf_structure", "chat_streaming"]
    }

@app.post("/api/quiz/generate", response_model=QuizGenerationResponse)
async def generate_quiz_endpoint(request: QuizGenerationRequest):
    """Genera evaluaciones adaptativas validadas con Pydantic basadas en tarjetas reales."""
    try:
        response = await generate_adaptive_quiz(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando evaluación adaptativa: {str(e)}")

@app.post("/api/pdf/structure")
async def structure_pdf_endpoint(payload: dict):
    """Procesa un PDF mediante PyMuPDF extrayendo tablas Markdown y metadatos de página."""
    pdf_url = payload.get("pdf_url")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="pdf_url es requerido")
    try:
        cards = await process_pdf_from_url(pdf_url)
        return {
            "success": True,
            "total": len(cards),
            "cards": cards
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando PDF: {str(e)}")


@app.post("/api/pdf/structure-4layers")
async def structure_pdf_4layers_endpoint(payload: dict):
    """Procesa un PDF desde URL con el pipeline fiable de 4 capas y guardrail numérico."""
    pdf_url = payload.get("pdf_url")
    mode = payload.get("mode")
    if not pdf_url:
        raise HTTPException(status_code=400, detail="pdf_url es requerido")
    try:
        import httpx
        from services.health_pdf_pipeline import process_pdf_with_4_layers

        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.get(pdf_url)
            res.raise_for_status()
            pdf_bytes = res.content

        outcome = await process_pdf_with_4_layers(pdf_bytes, mode=mode)
        cards = outcome.get("cards", [])
        return {
            "success": True,
            "total": len(cards),
            "cards": cards,
            "report": outcome.get("report", {}),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error procesando PDF (4 capas): {str(e)}")


@app.post("/api/vector/index-document")
async def index_document_vectors(payload: dict):
    """Indexa las tarjetas publicadas de un documento en Qdrant (best-effort)."""
    import hashlib
    from services.vector_repository import HybridVectorRecord, QdrantVectorRepository

    documento_id = str(payload.get("documento_id") or "")
    asignatura = str(payload.get("asignatura") or "general")
    documento_origen = str(payload.get("documento_origen") or documento_id)
    cards = payload.get("cards") or []

    if not documento_id or not isinstance(cards, list):
        raise HTTPException(status_code=400, detail="documento_id y cards son requeridos")

    repo = QdrantVectorRepository()
    try:
        repo.ensure_collection()
        indexed = 0
        for idx, c in enumerate(cards):
            title = str(c.get("titulo") or f"Tema #{idx + 1}")
            body = str(c.get("contenido") or "")
            markdown = f"## {title}\n{body}".strip()
            if not markdown:
                continue
            card_id = str(c.get("id") or f"{documento_id}-{idx}")
            content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
            record = HybridVectorRecord(
                id=card_id,
                parent_id=documento_id,
                rama_cientifica="nutricion",
                asignatura=asignatura,
                documento_origen=documento_origen,
                unidad=title,
                pagina_inicio=int(c.get("pagina") or 1),
                pagina_fin=int(c.get("pagina") or 1),
                contenido_markdown=markdown,
                content_hash=content_hash,
                embed_hash=content_hash,
                metadata={"orden": int(c.get("orden") or idx), "titulo": title},
            )
            if repo.upsert_chunk(record):
                indexed += 1
        return {"success": True, "indexed": indexed, "total": len(cards)}
    except Exception as e:
        return {"success": False, "indexed": 0, "error": str(e)}

@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: dict):
    """Transmite la respuesta del Profesor en tiempo real vía Server-Sent Events."""
    query = payload.get("query") or payload.get("chatInput") or ""
    session_id = payload.get("sessionId") or "default"
    user_id = payload.get("userId") or "anonymous"
    rama = payload.get("ramaCientifica")
    if not query:
        raise HTTPException(status_code=400, detail="Query no proporcionada")

    return StreamingResponse(
        stream_rag_tutor(query, session_id=session_id, user_id=user_id, rama_cientifica=rama),
        media_type="text/event-stream"
    )

@app.post("/api/chat")
async def chat_sync_endpoint(payload: dict):
    """Endpoint síncrono compatible con /api/cerebro si no se utiliza SSE."""
    query = payload.get("query") or payload.get("chatInput") or ""
    session_id = payload.get("sessionId") or "default"
    user_id = payload.get("userId") or "anonymous"
    rama = payload.get("ramaCientifica")
    if not query:
        raise HTTPException(status_code=400, detail="Query no proporcionada")

    import json
    collected = []
    async for chunk in stream_rag_tutor(
        query, session_id=session_id, user_id=user_id, rama_cientifica=rama
    ):
        if chunk.startswith("data: ") and not chunk.startswith("data: [DONE]"):
            try:
                data = json.loads(chunk[6:].strip())
                collected.append(data.get("token", ""))
            except Exception:
                pass
    return {"response": "".join(collected).strip()}

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
