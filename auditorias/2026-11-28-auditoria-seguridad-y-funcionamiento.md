# Auditoría de Seguridad, PII y Funcionamiento — Alquimia LMS

- **Fecha:** 2026-11-28
- **Entorno verificado:** Next.js (`http://127.0.0.1:3100`), Cerebro Python (`http://127.0.0.1:8155`), Supabase PostgreSQL + Auth + RLS, AWS S3 (`eu-west-1`)
- **Resultado global:** **APROBADO** (`16/16` controles en vivo, `0` errores TypeScript, `8/8` Vitest, `42/42` Pytest)

---

## 1. Auditoría Estática de Secretos y Exposición de PII

| Control | Alcance | Resultado |
| :--- | :--- | :---: |
| Datos personales (PII: nombres reales, emails personales, teléfonos, DNI/NIE) | `src/`, `cerebro-py/`, `docs/`, `scripts/`, `infra/`, `supabase/` | **0 coincidencias** |
| Archivos sensibles rastreados en Git (`.env.local`, `*.tfstate`, `*.tfvars`, `*.pem`, `*.key`) | `git ls-files` | **0 archivos** |
| Secretos y credenciales hardcodeadas (`AKIA...`, `sk-...`, claves privadas, secretos JWT, contraseñas maestras) | Todo el repositorio | **0 coincidencias** |
| Exposición de secretos en variables cliente (`NEXT_PUBLIC_*`) | `src/` | **0 coincidencias** |

### Endurecimiento aplicado
- `src/lib/auth/adminAuth.ts`: eliminados todos los valores *fallback* hardcodeados para `ADMIN_JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (comportamiento *fail-closed* si faltan variables de entorno), añadida comparación en tiempo constante (`crypto.timingSafeEqual`) y soporte para `DISABLE_DEMO_MODE=true`.
- `src/components/admin/LoginForm.tsx`: reemplazado placeholder de email real por placeholder genérico (`admin@ejemplo.com`).

---

## 2. Matriz en Vivo de Autenticación, RBAC, RLS y Salud (`16/16`)

| # | Prueba ejecutada en vivo | Estado | Evidencia |
| :-: | :--- | :---: | :--- |
| 1 | Anónimo ➔ `GET /api/admin/auth/me` | **PASS** | HTTP `401` |
| 2 | Anónimo ➔ `GET /api/admin/documents` | **PASS** | HTTP `401` |
| 3 | Anónimo ➔ `POST /api/admin/upload` | **PASS** | HTTP `401` |
| 4 | Anónimo ➔ `POST /api/jobs` | **PASS** | HTTP `401` |
| 5 | Aislamiento de borradores ➔ `GET /api/lesson/tarjetas` sobre unidad en `borrador` (`demo-muestra`) | **PASS** | HTTP `200`, `0` tarjetas devueltas |
| 6 | Lectura de publicados ➔ `GET /api/lesson/tarjetas` sobre unidad `publicado` (`UD6-CONTROL-ALIMENTARIO`) | **PASS** | HTTP `200`, `45` tarjetas devueltas |
| 7 | Profesor Demo ➔ `POST /api/admin/auth/login` | **PASS** | HTTP `200`, `role: "demo_teacher"` |
| 8 | Profesor Demo ➔ `POST /api/admin/upload` (subida de PDF externo) | **PASS** | Bloqueado con HTTP `403` |
| 9 | Profesor Demo ➔ `POST /api/admin/documents` (`delete_document` sobre unidad real) | **PASS** | Bloqueado con HTTP `403` |
| 10 | Profesor Demo ➔ `POST /api/admin/tarjetas` (`upsert_cards` sobre unidad real) | **PASS** | Bloqueado con HTTP `403` |
| 11 | Profesor Demo ➔ `POST /api/jobs` sobre unidad real | **PASS** | Bloqueado con HTTP `403` |
| 12 | Admin Maestro ➔ `POST /api/admin/auth/login` | **PASS** | HTTP `200`, `role: "admin"` |
| 13 | Regla de publicación ➔ `publish_document` con tarjetas pendientes (`needs_review = true`) | **PASS** | Bloqueado con HTTP `400` (*quedan tarjetas pendientes de verificación docente*) |
| 14 | Alumno Demo (`signInWithPassword`) + escritura directa con clave `anon` en `nutricionista.tarjetas` | **PASS** | Login `OK`; escritura bloqueada por RLS (`new row violates row-level security policy`) |
| 15 | `GET /api/health` (Next.js `:3100`) | **PASS** | HTTP `200` (`supabase: ok`, `cerebro_py: ok`; `qdrant: error` esperado con contenedor local apagado) |
| 16 | `GET /health` (`cerebro-py` `:8155`) | **PASS** | HTTP `200` |

### Corrección aplicada durante la auditoría
- `src/app/api/health/route.ts`: actualizada la sonda de Supabase de `/rest/v1/` a `/auth/v1/health`, pasando `/api/health` de HTTP `503` a HTTP `200` (`supabase: ok`, `cerebro_py: ok`).
- `src/app/admin/page.tsx`, `src/components/AppShell.tsx` y `src/app/login/page.tsx`: protegido `/admin` con `<AdminProtectedRoute>`, oculto el enlace `Admin` para alumnos en la barra superior y limpieza automática de cookie admin al iniciar sesión como alumno.

---

## 3. Verificación Automatizada de Código y Tests

| Suite | Comando | Resultado |
| :--- | :--- | :--- |
| TypeScript | `npm run lint` (`tsc --noEmit`) | **0 errores** |
| Unit / Contract Tests (TS) | `npm test` (`vitest run`) | **3 archivos, 8/8 tests pasados** |
| Python Core, Guardrails y Lambda | `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -q` | **42/42 tests pasados** (`58.13s`) |

---

## 4. Notas Operativas
- En entorno local, `qdrant` figura como `error` en `/api/health` (`status: "degraded"`, HTTP `200`) mientras el contenedor local de Qdrant esté apagado; la publicación de unidades funciona en modo *best-effort* sin bloquear al profesor.
- Para desactivar el modo Demo Profesor en producción basta con definir `DISABLE_DEMO_MODE=true` en las variables de entorno.
