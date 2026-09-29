import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = request.nextUrl.clone();

  // Si la ruta es del panel de administración (/admin/*), se delega a la autenticación autónoma
  if (url.pathname.startsWith('/admin')) {
    return supabaseResponse;
  }

  // Si la ruta es de la API de administración o integraciones, dejar pasar directo
  if (url.pathname.startsWith('/api/admin') || url.pathname.startsWith('/api/v1/integrations')) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tu-proyecto.supabase.co';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'tu-anon-key-aqui';

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
    });

    await supabase.auth.getUser();
  } catch {
    // Ignorar errores en rutas públicas
  }

  return supabaseResponse;
}
