import { NextResponse } from 'next/server';
import { validateAdminCredentials, signAdminToken, ADMIN_COOKIE_NAME } from '@/lib/auth/adminAuth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const isValid = validateAdminCredentials(email, password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales administrativas incorrectas' },
        { status: 401 }
      );
    }

    const token = await signAdminToken(email);

    const response = NextResponse.json({
      success: true,
      user: { email, role: 'admin' }
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 días
    });

    return response;
  } catch (error: any) {
    console.error('Admin Login API Error:', error);
    return NextResponse.json(
      { error: 'Error interno en el servidor de autenticación' },
      { status: 500 }
    );
  }
}
