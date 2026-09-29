import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ALQUIMIA_BACKEND_API_KEY || 'alquimia-n8n-sync-key-2026';
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '') || request.headers.get('x-api-key');

    if (authHeader !== apiKey) {
      return NextResponse.json({ error: 'No autorizado. API Key de integración inválida.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, documento_id, cards, content, docName, folder } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybqzcxabblyzqhezanaf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Acción 1: Sincronización o inserción directa de tarjetas de lección
    if (action === 'sync_cards' && documento_id && Array.isArray(cards)) {
      // Eliminar tarjetas previas del documento
      await supabaseAdmin.schema('nutricionista').from('tarjetas').delete().eq('documento_id', documento_id);

      const rowsToInsert = cards.map((c: any, index: number) => ({
        documento_id,
        titulo: c.titulo || c.title || `Sección ${index + 1}`,
        contenido: c.contenido || c.content || '',
        orden: c.orden !== undefined ? c.orden : index,
      }));

      const { data, error } = await supabaseAdmin.schema('nutricionista').from('tarjetas').insert(rowsToInsert).select();
      if (error) throw error;

      return NextResponse.json({ success: true, inserted: data?.length || rowsToInsert.length });
    }

    // Acción 2: Actualizar el contenido consolidado de un documento
    if (action === 'update_document_content' && documento_id && content) {
      const { error } = await supabaseAdmin
        .schema('nutricionista')
        .from('documentos')
        .update({ contenido: content, updated_at: new Date().toISOString() })
        .eq('id', documento_id);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Contenido del documento actualizado' });
    }

    // Acción 3: Registrar nuevo documento procesado por n8n
    if (action === 'register_document' && docName && folder) {
      const { data, error } = await supabaseAdmin
        .schema('nutricionista')
        .from('documentos')
        .insert([{
          nombre: docName,
          carpeta: folder,
          contenido: content || '',
          url: body.url || ''
        }])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, document: data });
    }

    return NextResponse.json({ error: 'Acción no especificada o payload incompleto' }, { status: 400 });
  } catch (error: any) {
    console.error('n8n Integration Route Error:', error);
    return NextResponse.json({ error: 'Error procesando solicitud de n8n', details: error.message }, { status: 500 });
  }
}
