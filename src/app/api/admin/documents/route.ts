import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { toKebabCase, splitIntoBlocks, joinBlocks } from "@/lib/content";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ybqzcxabblyzqhezanaf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseAdmin
      .schema("nutricionista")
      .from("documentos")
      .select("id, nombre, carpeta, url, orden, contenido, tarjetas(id)")
      .order("carpeta", { ascending: true })
      .order("nombre", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, documents: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const { action, name, id, newName, folder, doc_id, pdf_url } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ybqzcxabblyzqhezanaf.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Auto-estructurar PDF sin límites artificiales (100% de contenido preservado)
    if (action === "structure") {
      const targetDocId = doc_id || id;
      if (!targetDocId || !pdf_url) {
        return NextResponse.json({ error: "doc_id y pdf_url son requeridos" }, { status: 400 });
      }

      const pdfRes = await fetch(pdf_url);
      if (!pdfRes.ok) throw new Error("No se pudo descargar el PDF de Storage");
      const buffer = Buffer.from(await pdfRes.arrayBuffer());

      const pdfData = await pdfParse(buffer);
      const text = pdfData.text || "";

      if (!text.trim()) {
        return NextResponse.json({ error: "El PDF no contiene texto extraíble" }, { status: 400 });
      }

      const blocks = splitIntoBlocks(text);
      const joinedContent = joinBlocks(blocks);

      await supabaseAdmin
        .schema("nutricionista")
        .from("documentos")
        .update({ contenido: joinedContent, updated_at: new Date().toISOString() })
        .eq("id", targetDocId);

      const cardsToInsert = blocks.map((b, idx) => ({
        documento_id: targetDocId,
        titulo: b.title || `Sección ${idx + 1}`,
        contenido: b.content,
        orden: idx,
        updated_at: new Date().toISOString()
      }));

      // Borrar tarjetas viejas
      await supabaseAdmin.schema("nutricionista").from("tarjetas").delete().eq("documento_id", targetDocId);

      // Insertar en lotes de 50 para garantizar estabilidad en bases de datos y red
      const allInsertedCards: any[] = [];
      const batchSize = 50;
      for (let i = 0; i < cardsToInsert.length; i += batchSize) {
        const batch = cardsToInsert.slice(i, i + batchSize);
        const { data: batchResult, error: insErr } = await supabaseAdmin
          .schema("nutricionista")
          .from("tarjetas")
          .insert(batch)
          .select();

        if (insErr) throw insErr;
        if (batchResult) allInsertedCards.push(...batchResult);
      }

      return NextResponse.json({
        success: true,
        cards: allInsertedCards,
        total: allInsertedCards.length
      });
    }

    // 2. Crear Asignatura
    if (action === "create_asignatura" && name) {
      const folderName = toKebabCase(name.trim());
      const uniqueUrl = "placeholder://" + folderName + "-" + Date.now();
      const { data, error } = await supabaseAdmin
        .schema("nutricionista")
        .from("documentos")
        .insert([{
          nombre: ".emptyFolderPlaceholder",
          carpeta: folderName,
          url: uniqueUrl,
          orden: 0
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, document: data });
    }

    // 3. Renombrar Documento
    if (action === "rename_document" && id && newName) {
      const { error } = await supabaseAdmin
        .schema("nutricionista")
        .from("documentos")
        .update({ nombre: newName })
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 4. Borrar Documento
    if (action === "delete_document" && id) {
      await supabaseAdmin.schema("nutricionista").from("tarjetas").delete().eq("documento_id", id);
      const { error } = await supabaseAdmin.schema("nutricionista").from("documentos").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 5. Borrar Asignatura
    if (action === "delete_asignatura" && folder) {
      const { data: docs } = await supabaseAdmin.schema("nutricionista").from("documentos").select("id").eq("carpeta", folder);
      if (docs && docs.length > 0) {
        for (const doc of docs) {
          await supabaseAdmin.schema("nutricionista").from("tarjetas").delete().eq("documento_id", doc.id);
        }
      }
      const { error } = await supabaseAdmin.schema("nutricionista").from("documentos").delete().eq("carpeta", folder);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error: any) {
    console.error("Documents Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
