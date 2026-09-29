import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET || "alquimia-supabase-webhook-secret-2026";
    const authHeader = request.headers.get("x-supabase-webhook-secret") || request.headers.get("authorization")?.replace("Bearer ", "");

    if (authHeader !== webhookSecret) {
      return NextResponse.json({ error: "No autorizado. Secreto de webhook inválido." }, { status: 401 });
    }

    const payload = await request.json();
    console.log("Evento recibido desde Supabase:", payload.type || "database_event", payload.record?.nombre || "");

    // Reenviar al webhook de n8n para procesamiento de PDF y generación de tarjetas
    const n8nProcesarPdfUrl =
      process.env.N8N_PROCESAR_PDF_URL ||
      "https://cerebro.agencialquimia.com/webhook/cerebro-procesar-pdf";

    let n8nResponseData = null;
    try {
      const n8nRes = await fetch(n8nProcesarPdfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "supabase_database_webhook",
          event: payload,
          document: payload.record || null,
          timestamp: new Date().toISOString()
        })
      });

      if (n8nRes.ok) {
        n8nResponseData = await n8nRes.json().catch(() => null);
      }
    } catch (err: any) {
      console.warn("Aviso: n8n webhook cerebro-procesar-pdf no respondió:", err.message);
    }

    return NextResponse.json({
      success: true,
      message: "Evento de Supabase recibido y canalizado a n8n para procesamiento de PDF",
      n8nResponse: n8nResponseData
    });
  } catch (error: any) {
    console.error("Supabase Integration Route Error:", error);
    return NextResponse.json({ error: "Error procesando webhook de Supabase", details: error.message }, { status: 500 });
  }
}
