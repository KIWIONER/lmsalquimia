import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const cerebroPyUrl = process.env.CEREBRO_PY_URL || "http://127.0.0.1:8055";

    // 1. Enrutar generación de evaluaciones al microservicio Python
    if (body.action === "generate_quiz") {
      try {
        const pyRes = await fetch(`${cerebroPyUrl}/api/quiz/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics: body.selectedTopics || body.topics || [],
            difficulty: body.difficulty || 5,
            numQuestions: body.numQuestions || 10,
            mode: body.mode || "practice",
            sessionId: body.sessionId || `quiz-${Date.now()}`
          }),
        });

        if (pyRes.ok) {
          const pyData = await pyRes.json();
          // Devolver el arreglo de preguntas validado por Pydantic
          return NextResponse.json(pyData.questions || pyData);
        }
      } catch (pyErr: any) {
        console.warn("Aviso: cerebro-py no respondió para quiz, intentando canal secundario:", pyErr.message);
      }
    }

    // 2. Chat del Tutor: Intentar Python Core con timeout rápido
    const webhookUrl =
      process.env.N8N_CEREBRO_URL ||
      process.env.PUBLIC_N8N_CEREBRO_URL ||
      process.env.NEXT_PUBLIC_N8N_CEREBRO_URL ||
      process.env.N8N_WEBHOOK_URL ||
      "https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista";

    // Intentar primero con el servicio Python de streaming/cache si está activo
    try {
      const pyChatRes = await fetch(`${cerebroPyUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000), // 8 segundos máximo
      });
      if (pyChatRes.ok) {
        const pyChatData = await pyChatRes.json();
        if (pyChatData && pyChatData.response) {
          return NextResponse.json(pyChatData);
        }
      }
    } catch {
      // Si falla Python, continuar con webhook de n8n
    }

    // Fallback a n8n con timeout de 15 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      return NextResponse.json(
        { error: "Servidor de Cerebro n8n no disponible", status: response.status },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API Cerebro Route Error:", error);
    return NextResponse.json(
      { 
        error: "El Cerebro de Alquimia está procesando una consulta extensa o no se pudo conectar.",
        details: error.message 
      },
      { status: 503 }
    );
  }
}
