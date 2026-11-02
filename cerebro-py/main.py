import os
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from schemas.quiz import QuizGenerationRequest, QuizGenerationResponse
from services.quiz_service import generate_adaptive_quiz
from services.pdf_service import process_pdf_from_url
from services.chat_service import stream_n8n_or_fallback
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

@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: dict):
    """Transmite la respuesta del Profesor en tiempo real vía Server-Sent Events."""
    query = payload.get("query") or payload.get("chatInput") or ""
    session_id = payload.get("sessionId") or "default"
    if not query:
        raise HTTPException(status_code=400, detail="Query no proporcionada")

    return StreamingResponse(
        stream_n8n_or_fallback(query, session_id),
        media_type="text/event-stream"
    )

@app.post("/api/chat")
async def chat_sync_endpoint(payload: dict):
    """Endpoint síncrono compatible con /api/cerebro si no se utiliza SSE."""
    query = payload.get("query") or payload.get("chatInput") or ""
    session_id = payload.get("sessionId") or "default"
    if not query:
        raise HTTPException(status_code=400, detail="Query no proporcionada")

    # Acumular tokens del stream para entregar respuesta síncrona
    import json
    collected = []
    async for chunk in stream_n8n_or_fallback(query, session_id):
        if chunk.startswith("data: ") and not chunk.startswith("data: [DONE]"):
            try:
                data = json.loads(chunk[6:].strip())
                collected.append(data.get("token", ""))
            except Exception:
                pass
    return {"response": "".join(collected).strip()}

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=False)
