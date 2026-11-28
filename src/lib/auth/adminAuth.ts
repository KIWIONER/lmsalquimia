import { timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

export const ADMIN_COOKIE_NAME = 'alquimia_admin_session';

const getJwtSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_JWT_SECRET no configurado en variables de entorno.');
  }
  return new TextEncoder().encode(secret);
};

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type AdminRole = 'admin' | 'demo_teacher';

export interface AdminSessionPayload {
  email: string;
  role: AdminRole;
  iat?: number;
  exp?: number;
}

/**
 * Firma un JWT para la sesión administrativa o demo docente con validez de 7 días.
 */
export async function signAdminToken(email: string, role: AdminRole = 'admin'): Promise<string> {
  const secret = getJwtSecret();
  return await new SignJWT({ email, role })
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
  } catch {
    return null;
  }
}

/**
 * Valida credenciales contra las cuentas de administración (fail-closed) o demo docente.
 */
export function validateAdminCredentials(emailInput: string, passwordInput: string): AdminRole | null {
  const configuredEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD || '';

  const cleanEmail = (emailInput || '').trim().toLowerCase();
  const cleanPassword = passwordInput || '';

  if (
    configuredEmail &&
    configuredPassword &&
    safeCompare(cleanEmail, configuredEmail) &&
    safeCompare(cleanPassword, configuredPassword)
  ) {
    return 'admin';
  }

  if (process.env.DISABLE_DEMO_MODE !== 'true') {
    const demoEmail = (process.env.DEMO_TEACHER_EMAIL || 'profesor.demo@alquimia.es').trim().toLowerCase();
    const demoPassword = process.env.DEMO_TEACHER_PASSWORD || 'DemoProfesor2026!';
    if (safeCompare(cleanEmail, demoEmail) && safeCompare(cleanPassword, demoPassword)) {
      return 'demo_teacher';
    }
  }

  return null;
}
