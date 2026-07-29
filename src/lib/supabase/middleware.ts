import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'tu-anon-key-aqui',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión si ha expirado
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protección de rutas administrativas y privadas si fuera necesario
  const url = request.nextUrl.clone();
  if (!user && url.pathname.startsWith('/admin') && url.pathname !== '/admin/login') {
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
