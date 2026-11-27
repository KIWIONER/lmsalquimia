import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión Supabase activa." },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("async_jobs")
      .select(
        "id, type, status, input_key, result_url, result_payload, error_message, attempts, correlation_id, created_at, updated_at"
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Trabajo asíncrono no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ job: data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("GET /api/jobs/[id] Error:", error);
    return NextResponse.json(
      { error: "Error consultando estado del trabajo.", details: message },
      { status: 500 }
    );
  }
}
