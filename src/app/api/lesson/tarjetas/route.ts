import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("doc_id");
    if (!docId) {
      return NextResponse.json({ success: true, cards: [] });
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://ybqzcxabblyzqhezanaf.supabase.co";
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      "";

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Solo devolver tarjetas si el documento está publicado (aislamiento de borradores)
    const { data: doc, error: docErr } = await supabaseAdmin
      .schema("nutricionista")
      .from("documentos")
      .select("id, estado")
      .eq("id", docId)
      .eq("estado", "publicado")
      .maybeSingle();

    if (docErr) throw docErr;
    if (!doc) {
      return NextResponse.json({ success: true, cards: [] });
    }

    const { data: cards, error: cardsErr } = await supabaseAdmin
      .schema("nutricionista")
      .from("tarjetas")
      .select("id, documento_id, titulo, contenido, orden, created_at, updated_at")
      .eq("documento_id", docId)
      .order("orden", { ascending: true });

    if (cardsErr) throw cardsErr;
    return NextResponse.json({ success: true, cards: cards || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error cargando tarjetas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
