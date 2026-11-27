import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCerebroRequest } from "@/lib/schemas/cerebro";
import {
  buildKnowledgeCacheKey,
  checkRateLimit,
  getCachedJson,
  setCachedJson,
} from "@/lib/redis/rateLimiter";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsed = parseCerebroRequest(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Payload inválido para /api/cerebro.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

    const rateKey = user?.id || request.headers.get("x-forwarded-for") || "anonymous";
    const feature = body.action === "generate_quiz" ? "quiz" : "chat";
    const rl = await checkRateLimit(rateKey, feature);

    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "Has superado el límite temporal de consultas. Inténtalo de nuevo más tarde.",
          retryAfterSeconds: rl.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSeconds) },
        }
      );
    }

    const cerebroPyUrl = process.env.CEREBRO_PY_URL || "http://127.0.0.1:8155";

    // 1. Generación de evaluaciones adaptativas
    if (body.action === "generate_quiz") {
      const topics = body.selectedTopics ?? body.topics ?? [];
      const cacheKey = buildKnowledgeCacheKey({
        action: "generate_quiz",
        topics,
        difficulty: body.difficulty,
        promptVersion: "v2",
      });

      const cached = await getCachedJson<unknown>(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: { "X-Cache-Hit": "true" },
        });
      }

      const pyRes = await fetch(`${cerebroPyUrl}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          difficulty: body.difficulty,
          numQuestions: body.numQuestions,
          mode: body.mode,
          sessionId: body.sessionId || `quiz-${Date.now()}`,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!pyRes.ok) {
        return NextResponse.json(
          { error: "Error generando evaluación adaptativa en cerebro-py." },
          { status: pyRes.status }
        );
      }

      const pyData = await pyRes.json();
      const result = pyData.questions || pyData;
      await setCachedJson(cacheKey, result, 86400);

      return NextResponse.json(result, {
        headers: { "X-Cache-Hit": "false" },
      });
    }

    // 2. Chat del Tutor IA (sin fallback legacy a n8n)
    const queryText = body.query ?? body.chatInput ?? "";
    const isBaseQuery = !body.sessionId || body.sessionId === "default";
    const chatCacheKey = isBaseQuery
      ? buildKnowledgeCacheKey({
          action: "chat",
          topics: body.topics,
          query: queryText,
          promptVersion: "v2",
        })
      : null;

    if (chatCacheKey) {
      const cachedChat = await getCachedJson<unknown>(chatCacheKey);
      if (cachedChat) {
        return NextResponse.json(cachedChat, {
          headers: { "X-Cache-Hit": "true" },
        });
      }
    }

    const pyChatRes = await fetch(`${cerebroPyUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: queryText,
        sessionId: body.sessionId || "default",
        userId: user?.id || "anonymous",
        topics: body.topics || [],
        ramaCientifica: body.ramaCientifica || null,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!pyChatRes.ok) {
      return NextResponse.json(
        { error: "El servicio cerebro-py no pudo completar la consulta." },
        { status: pyChatRes.status }
      );
    }

    const pyChatData = await pyChatRes.json();
    if (chatCacheKey && pyChatData?.response) {
      await setCachedJson(chatCacheKey, pyChatData, 86400);
    }

    return NextResponse.json(pyChatData, {
      headers: { "X-Cache-Hit": "false" },
    });
  } catch (error: unknown) {
    const details = error instanceof Error ? error.message : "Error desconocido";
    console.error("API Cerebro Route Error:", error);
    return NextResponse.json(
      {
        error: "El Cerebro de Alquimia no pudo procesar la solicitud en este momento.",
        details,
      },
      { status: 503 }
    );
  }
}
