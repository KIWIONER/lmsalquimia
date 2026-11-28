import { NextResponse, type NextRequest } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { getS3BucketName, getS3Client } from "@/lib/aws/clients";
import { toKebabCase } from "@/lib/content";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;

    if (!session) {
      return NextResponse.json({ error: "No autorizado. Sesión de administrador requerida." }, { status: 401 });
    }
    if (session.role === "demo_teacher") {
      return NextResponse.json(
        { error: "El modo Demo Profesor no permite subir PDFs externos. Usa el PDF de muestra incluido." },
        { status: 403 }
      );
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
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const originalName = `${Date.now()}_${safeName}`;
    const s3Key = `uploads/pdfs/biblioteca/dietetica-nutricion/${folderName}/${originalName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Subir a AWS S3
    const bucket = getS3BucketName();
    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || "application/pdf",
      })
    );

    const s3Url = `s3://${bucket}/${s3Key}`;

    // 2. Insertar en tabla documentos en estado borrador (Flujo Docente Fase B)
    const docName = file.name.replace(/\.[^/.]+$/, "");
    const { data: docData, error: dbError } = await supabaseAdmin
      .schema("nutricionista")
      .from("documentos")
      .insert([{
        nombre: docName,
        carpeta: folderName,
        url: s3Url,
        orden: 99,
        estado: "borrador",
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
      s3Key,
      s3Url,
      publicUrl: s3Url,
    });
  } catch (error: any) {
    console.error("Upload Route Error:", error);
    return NextResponse.json(
      { error: "Error al subir el PDF a S3 y registrar en la base de datos", details: error.message },
      { status: 500 }
    );
  }
}
