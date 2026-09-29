import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_COOKIE_NAME = 'alquimia_admin_session';

const getJwtSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET || 'alquimia-lms-super-secret-key-2026-secure-jwt';
  return new TextEncoder().encode(secret);
};

export interface AdminSessionPayload {
  email: string;
  role: 'admin';
  iat?: number;
  exp?: number;
}

/**
 * Firma un JWT para la sesión administrativa con validez de 7 días.
 */
export async function signAdminToken(email: string): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({ email, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Verifica un token JWT administrativo.
 */
export async function verifyAdminToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as AdminSessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Valida credenciales contra las variables de entorno de administración autónoma.
 */
export function validateAdminCredentials(emailInput: string, passwordInput: string): boolean {
  const configuredEmail = (process.env.ADMIN_EMAIL || 'director@agencialquimia.com').trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD || 'Alquimia2026!';

  const cleanEmail = (emailInput || '').trim().toLowerCase();
  const cleanPassword = passwordInput || '';

  return cleanEmail === configuredEmail && cleanPassword === configuredPassword;
}
