import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const session = token ? await verifyAdminToken(token) : null;
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const docId = searchParams.get('doc_id');
    if (!docId) return NextResponse.json({ cards: [] });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybqzcxabblyzqhezanaf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
    const { action, documento_id, cards } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybqzcxabblyzqhezanaf.supabase.co';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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
