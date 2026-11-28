import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth/adminAuth';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybqzcxabblyzqhezanaf.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('doc_id');
    if (!docId) return NextResponse.json({ cards: [] });

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .schema('nutricionista')
      .from('tarjetas')
      .select('*')
      .eq('documento_id', docId)
      .order('orden', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ success: true, cards: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { action, documento_id, cards, id, fields, card, ids } = body;

    const supabaseAdmin = getSupabaseAdmin();

    if (session.role === 'demo_teacher') {
      let targetDocId = documento_id || card?.documento_id;
      if (!targetDocId && id) {
        const { data: cRow } = await supabaseAdmin
          .schema('nutricionista')
          .from('tarjetas')
          .select('documento_id')
          .eq('id', id)
          .maybeSingle();
        targetDocId = cRow?.documento_id;
      }
      if (!targetDocId && Array.isArray(ids) && ids.length > 0) {
        const { data: cRow } = await supabaseAdmin
          .schema('nutricionista')
          .from('tarjetas')
          .select('documento_id')
          .eq('id', ids[0])
          .maybeSingle();
        targetDocId = cRow?.documento_id;
      }
      const { data: docRow } = targetDocId
        ? await supabaseAdmin.schema('nutricionista').from('documentos').select('carpeta').eq('id', targetDocId).maybeSingle()
        : { data: null };
      if (!docRow || docRow.carpeta !== 'demo-muestra') {
        return NextResponse.json(
          { error: 'En modo Demo Profesor solo puedes editar tarjetas en la unidad de muestra (demo-muestra).' },
          { status: 403 }
        );
      }
    }

    if (action === 'update_card' && id && fields && typeof fields === 'object') {
      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (fields.titulo !== undefined) updateData.titulo = fields.titulo;
      if (fields.contenido !== undefined) updateData.contenido = fields.contenido;
      if (fields.orden !== undefined) updateData.orden = fields.orden;
      if (fields.needs_review !== undefined) updateData.needs_review = Boolean(fields.needs_review);

      const { data, error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, card: data });
    }

    if (action === 'upsert_cards' && documento_id && Array.isArray(cards)) {
      if (cards.length === 0) return NextResponse.json({ success: true, cards: [] });
      const now = new Date().toISOString();
      const rows = cards.map((c: any, i: number) => ({
        id: c.id,
        documento_id,
        titulo: c.titulo || `Tema #${i + 1}`,
        contenido: c.contenido || '',
        orden: c.orden !== undefined ? c.orden : i,
        updated_at: now,
      }));
      const { data, error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .upsert(rows)
        .select();
      if (error) throw error;
      return NextResponse.json({ success: true, cards: data });
    }

    if (action === 'add_card' && card && card.documento_id) {
      const row = {
        ...card,
        updated_at: card.updated_at || new Date().toISOString(),
      };
      const { data, error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, card: data });
    }

    if (action === 'delete_card' && id) {
      const { error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'bulk_delete' && Array.isArray(ids) && ids.length > 0) {
      const { error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .delete()
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'bulk_verify' && Array.isArray(ids) && ids.length > 0) {
      const { error } = await supabaseAdmin
        .schema('nutricionista')
        .from('tarjetas')
        .update({ needs_review: Boolean(body.needs_review), updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'save_cards' && documento_id && Array.isArray(cards)) {
      await supabaseAdmin.schema('nutricionista').from('tarjetas').delete().eq('documento_id', documento_id);
      if (cards.length > 0) {
        const rows = cards.map((c: any, i: number) => ({
          documento_id,
          titulo: c.titulo || `Tema #${i + 1}`,
          contenido: c.contenido || '',
          orden: c.orden !== undefined ? c.orden : i,
          updated_at: new Date().toISOString()
        }));
        const { data, error } = await supabaseAdmin.schema('nutricionista').from('tarjetas').insert(rows).select();
        if (error) throw error;
        return NextResponse.json({ success: true, cards: data });
      }
      return NextResponse.json({ success: true, cards: [] });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
