# Fase 3 — Estrategia de Seguridad, Datos y Calidad de Producción

> **Guía de Arquitectura · Alquimia LMS (Nivel Mid 45k€)**
> **Objetivo estratégico:** Blindar la capa de datos en Supabase, automatizar la calidad con pirámide de testing completa en CI/CD y dotar a la aplicación de diagnósticos listos para producción.

---

## 1. Propósito

Un sistema distribuido con IA no es apto para producción si sus tablas en base de datos carecen de aislamiento por usuario (RLS), si el esquema no está versionado en migraciones reproducibles o si el pipeline de CI solo comprueba que compila sin ejecutar tests.

Esta fase cierra las brechas de **seguridad de datos, testing automatizado (unitario + E2E) y operabilidad (healthchecks y logs estructurados)**.

---

## 2. Objetivo a Conseguir

1. **Seguridad y gobierno de datos en Supabase:** 100% de las tablas con Row Level Security (RLS) habilitado y auditado, más historial completo de esquema versionado en `supabase/migrations/`.
2. **Pirámide de testing real en CI/CD (GitHub Actions):**
   - Análisis estático (`tsc --noEmit` + ESLint).
   - Tests unitarios y de integración (**Vitest** en Next.js + **Pytest** en Python/Lambda).
   - **2–3 tests E2E con Playwright** cubriendo el flujo crítico de negocio.
3. **Operabilidad en producción:** Endpoint `/api/health` en Next.js (con estado de dependencias) y logging estructurado en formato JSON con `correlation_id`.

---

## 3. Punto de Partida (Estado Actual Auditado)

- **Base de datos (`supabase/schema.sql`):** Solo define 2 tablas (`quiz_attempts`, `lms_notifications`) y 1 trigger (`tr_check_failures`). **No tiene políticas RLS**, no existe `supabase/migrations/` y faltan tablas del esquema `nutricionista` (`documentos`, `pasos_completados`, etc.) usadas por la app.
- **Testing:** `cerebro-py/tests/` tiene 6 suites de `pytest`, pero Next.js **no tiene Vitest ni Playwright**.
- **CI/CD (`.github/workflows/deploy.yml`):** Solo ejecuta `npm run build` en push a `main`.
- **Healthcheck y Logs:** `cerebro-py/main.py` expone `GET /health`, pero Next.js no tiene `/api/health` y usa `console.log`/`console.error` en texto plano.

---

## 4. Requisitos y Alcance (Qué vamos a hacer)

### R3.1 — Migraciones Versionadas y Auditoría RLS en Supabase
- Inicializar estructura oficial `supabase/migrations/` con migraciones numeradas cronológicamente (`YYYYMMDDHHMMSS_descripcion.sql`):
  1. Migración base con todas las tablas de `public` y `nutricionista` (y `async_jobs` de Fase 1).
  2. Migración de triggers y publicación Realtime.
  3. Migración dedicada de **Row Level Security (RLS)**:
     - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en **todas** las tablas.
     - Políticas estrictas por rol: el alumno solo lee/escribe sus propios `quiz_attempts`, `lms_notifications`, `pasos_completados` y `async_jobs` (`auth.uid() = user_id`); solo el rol `admin` puede mutar `nutricionista.documentos` y tarjetas docentes.
- Documentar matriz de permisos (Tabla × Rol × `SELECT/INSERT/UPDATE/DELETE`) en `supabase/RLS_MATRIX.md`.

### R3.2 — Testing Unitario (Vitest + Pytest) y E2E (Playwright)
- **Vitest (Next.js):** Configurar `vitest.config.ts` y cubrir lógica crítica:
  - Parsing de micro-tarjetas (`src/lib/content.ts`), esquemas Zod, stores (`quizStore.ts`, `chatStore.ts`) y handlers de API con mocks.
- **Pytest (Python):** Mantener y ampliar `cerebro-py/tests/` incluyendo el handler de Lambda, idempotencia de jobs SQS y fallback multi-LLM.
- **Playwright (2–3 flujos E2E críticos):**
  1. `auth-and-dashboard.spec.ts`: Login de usuario de prueba → acceso autenticado a `/dashboard` y bloqueo de `/admin` sin rol.
  2. `lesson-and-itinerary.spec.ts`: Navegación a lección/planificación → solicitud de itinerario/resumen IA (con mock/stub determinista en CI).
  3. `quiz-evaluation.spec.ts`: Inicio de evaluación en `/evaluacion` → completar preguntas → verificación de resultado y guardado de intento.

### R3.3 — Pipeline CI/CD en GitHub Actions
- Reestructurar `.github/workflows/` separando `ci.yml` (en cada PR y push a `main`) y `deploy.yml`:
  - **Job 1 (`frontend-quality`):** `npm ci` → `tsc --noEmit` → ESLint → `vitest run` → `npm run build`.
  - **Job 2 (`python-quality`):** Setup Python → `pip install -r cerebro-py/requirements.txt` → `pytest`.
  - **Job 3 (`e2e-playwright`):** Levantar app en modo test → ejecutar suite Playwright → subir reporte HTML como artefacto en caso de fallo.
  - **Job 4 (`infra-validate`):** `terraform fmt -check` y `terraform validate` cuando haya cambios en `infra/`.

### R3.4 — Endpoint `/api/health` y Logs Estructurados en JSON
- Crear `src/app/api/health/route.ts` que devuelva `200 OK` (o `503 Degraded`) con:
  - `status`, `version`, `timestamp`, `uptime_s`.
  - Checks ligeros de conectividad: Supabase, Redis, **Qdrant** y estado de cola/servicio IA.
- Implementar logger ligero estructurado (`src/lib/logger.ts` con `pino` o wrapper JSON nativo) que emita líneas JSON (`timestamp`, `level`, `service`, `correlation_id`, `user_id`, `route`, `duration_ms`, `message`) tanto en Next.js como en Python (`logging` con formatter JSON).

---

## 5. Plan de Evaluación y Criterios de Aceptación (Qué vamos a evaluar)

### Checklist de Verificación

| ID | Criterio de Evaluación | Método de Verificación | Estado Objetivo |
| :--- | :--- | :--- | :--- |
| **EV3.1** | 100% tablas con RLS activo | Consulta SQL sobre `pg_tables` (`rowsecurity = true`) + pruebas con 2 usuarios distintos intentando leer datos cruzados | 0 tablas desprotegidas; acceso cruzado retorna 0 filas / `403` |
| **EV3.2** | Migraciones reproducibles desde cero | Aplicar `supabase/migrations/` en una base de datos limpia (Supabase local / branch) | Ejecución limpia sin errores |
| **EV3.3** | Cobertura de tests unitarios | `vitest run` + `pytest` en GitHub Actions | 100% pass en CI |
| **EV3.4** | Tests E2E Playwright estables | Ejecución de 2–3 specs E2E en CI sin flakiness en 3 corridas consecutivas | 3/3 verdes |
| **EV3.5** | `/api/health` y logs JSON | `GET /api/health` devuelve JSON estructurado con estado de dependencias; inspección de stdout en petición real | JSON parseable en 100% de rutas API |

### Definition of Done (DoD)
La Fase 3 se da por cerrada cuando un Pull Request en GitHub dispara automáticamente validación de tipos, lint, Vitest, Pytest, Playwright y Terraform; todas las tablas de Supabase tienen RLS verificado con pruebas de aislamiento; y la app expone `/api/health` con trazas JSON limpias.

---

## 6. Riesgos y Mitigaciones

- **Riesgo:** Tests E2E frágiles o lentos por depender de llamadas reales a LLMs externos en CI.
  - *Mitigación:* Usar interceptación de red de Playwright (`page.route`) o modo mock para las respuestas del LLM en E2E, reservando las llamadas reales a la suite de Evals de la Fase 2.
- **Riesgo:** Bloquear funcionalidades existentes al activar RLS (especialmente webhooks o workers).
  - *Mitigación:* Diferenciar claramente el cliente con `anon key` (sesión de usuario, sujeto a RLS) del cliente servidor con `service_role` (solo en backend/Lambda para escritura controlada de resultados de jobs).
