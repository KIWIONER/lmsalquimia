import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { toKebabCase } from "@/lib/content";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "No autorizado. Sesión de administrador requerida." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const asignatura = (formData.get("asignatura") as string) || "General";

    if (!file) {
      return NextResponse.json({ error: "No se ha proporcionado ningún archivo PDF" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ybqzcxabblyzqhezanaf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const folderName = toKebabCase(asignatura.trim());
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "");
    const originalName = `${Date.now()}_${safeName}`;
    const filePath = `dietetica-nutricion/${folderName}/${originalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Subir al bucket con el Service Role Key (bypasea RLS)
    const { error: uploadError } = await supabaseAdmin.storage
      .from("cerebro-nutricionista")
      .upload(filePath, buffer, {
        contentType: file.type || "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage Upload Error:", uploadError);
      throw uploadError;
    }

    // 2. Obtener URL pública
    const { data: publicUrlData } = supabaseAdmin.storage
      .from("cerebro-nutricionista")
      .getPublicUrl(filePath);

    // 3. Insertar en tabla documentos
    const docName = file.name.replace(/\.[^/.]+$/, "");
    const { data: docData, error: dbError } = await supabaseAdmin
      .schema("nutricionista")
      .from("documentos")
      .insert([{
        nombre: docName,
        carpeta: folderName,
        url: publicUrlData.publicUrl,
        orden: 99
      }])
      .select()
      .single();

    if (dbError) {
      console.error("Database Insert Error:", dbError);
      throw dbError;
    }

    return NextResponse.json({
      success: true,
      document: docData,
      publicUrl: publicUrlData.publicUrl
    });
  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json(
      { error: "Error al subir el PDF y registrar en la base de datos", details: error.message },
      { status: 500 }
    );
  }
}
