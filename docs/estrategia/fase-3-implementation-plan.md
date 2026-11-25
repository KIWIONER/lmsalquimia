# Implementation Plan — Fase 3: Seguridad, Datos y Calidad de Producción

> **Estrategia asociada:** [`fase-3-seguridad-datos-calidad-produccion.md`](./fase-3-seguridad-datos-calidad-produccion.md)
> **Documento Maestro:** [`CONTEXT.md`](../../CONTEXT.md)
> **Dominio:** Plataforma EdTech Interactiva de Ciencias de la Salud y Ciencias Exactas (Medicina, Nutrición, Química, Bioquímica y Física)
> **Clasificación Code Refinement Suite:** **Nivel 3 — Complejidad Alta (Arquitectura / Módulo Crítico)** (`PACK_ARCHITECT ➔ PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR`)

---

## 1. PACK_ARCHITECT: Ideación Técnica (Tree of Thoughts + 3 Expertos)

### Diagnóstico Fáctico de Partida (Verificado en el Codebase)
1. **Base de datos y migraciones:**
   - `supabase/schema.sql` solo define `quiz_attempts`, `lms_notifications` y el trigger `tr_check_failures` sin `ENABLE ROW LEVEL SECURITY`.
   - `supabase/migrations/` ya fue inicializado en Fase 1 con `20261124_async_jobs.sql`, pero faltan las migraciones base de `public` y `nutricionista` (`documentos`, `tarjetas`, `pasos_completados`, etc.) y las políticas RLS globales.
2. **Pirámide de testing incompleta:**
   - `cerebro-py/tests/` cuenta con 6 suites (33 tests `pytest` verdes).
   - Next.js (`package.json`) no tiene aún **Vitest** ni **Playwright**, aunque existen piezas críticas testeables (`src/lib/content.ts`, `src/lib/schemas/cerebro.ts`, `src/lib/aws/jobContracts.ts`, `src/store/*`).
3. **CI/CD y Operabilidad:**
   - `.github/workflows/deploy.yml` ejecuta `tsc --noEmit`, `next build` y `pytest`, pero falta `vitest`, `playwright` y `terraform fmt/validate`.
   - `cerebro-py/main.py` expone `GET /health`, pero Next.js carece de `/api/health` y de un logger estructurado en JSON con `correlation_id`.

### Comparativa Tree of Thoughts (ToT) — Testing, Logger y Migraciones

| Eje | Alternativa A | Alternativa B (Seleccionada) | Alternativa C | Decisión |
| :--- | :--- | :--- | :--- | :--- |
| **Logger JSON** | `pino` + `pino-pretty` | **Wrapper JSON nativo (`src/lib/logger.ts`)** + `logging` JSON formatter en Python (`cerebro-py/services/json_logger.py`) | `console.log` plano | **B:** Cero dependencias npm pesadas, compatible 100% con Edge/Node/Turbopack/Webpack y emite JSON parseable con `correlation_id` desde el día 1. |
| **E2E en CI** | Playwright contra LLM real | **Playwright con `page.route` determinista** para endpoints LLM/externos | Cypress | **B:** Evita flakiness y costes en CI (respetando la mitigación de la estrategia), manteniendo 3 specs estables y rápidas. |
| **Migraciones SQL** | Un único `schema.sql` monolítico | **Migraciones cronológicas en `supabase/migrations/`** (base + triggers + RLS) + `supabase/RLS_MATRIX.md` | Gestión manual en Dashboard | **B:** Reproducible desde cero en cualquier branch/entorno local y auditable en PRs. |

### Dictamen del Panel de 3 Expertos
- **UX/UI Specialist:** Los flujos E2E de Playwright deben validar la experiencia real del alumno (login → `/dashboard`, navegación en `/leccion/...` o `/planificacion`, y evaluación completa en `/evaluacion`) asegurando mensajes claros ante bloqueos de `/admin` sin sesión docente.
- **Dev Lead:** Reutilizar `vitest` para lógica pura y Route Handlers con mocks (`src/lib/content.ts`, `src/lib/schemas/cerebro.ts`, `src/lib/aws/jobContracts.ts`, `src/app/api/health/route.ts`), mantener `pytest` en `cerebro-py/tests/` y separar `ci.yml` (PRs y `main`) de `deploy.yml`.
- **Security Specialist (Sec):**
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` obligatorio en **100% de las tablas** (`public` y `nutricionista`).
  - Políticas `default-deny`: sin `USING (true)` en tablas de alumnos; cada usuario solo accede a `auth.uid() = user_id`. Las tablas docentes (`nutricionista.documentos`, `nutricionista.tarjetas`) permiten `SELECT` autenticado/público según diseño de catálogo y restringen `INSERT/UPDATE/DELETE` exclusivamente a `service_role` (usado por los endpoints `/api/admin/*` tras `verifyAdminToken`).
  - `/api/health` nunca debe exponer secretos, URLs con credenciales ni stack traces en la respuesta JSON.

---

## 2. PACK_PLANNER: Diseño por Bloques y Reglas de Producción

### Bloque A — Migraciones Versionadas y Auditoría RLS en Supabase (R3.1)

1. **`supabase/migrations/2026112501_base_tables.sql`:**
   - Consolida de forma idempotente (`CREATE SCHEMA IF NOT EXISTS nutricionista`, `CREATE TABLE IF NOT EXISTS ...`) todas las tablas usadas por la app:
     - `public.quiz_attempts`, `public.lms_notifications`, `public.async_jobs` (referenciando `20261124_async_jobs.sql`).
     - `nutricionista.documentos`, `nutricionista.tarjetas`, `nutricionista.pasos_completados` (con `user_id`, `unidad`, `paso_id`).
2. **`supabase/migrations/2026112502_triggers_and_realtime.sql`:**
   - Consolida `check_failed_attempts` (`tr_check_failures`), `set_async_jobs_updated_at` y publicación Realtime idempotente.
3. **`supabase/migrations/2026112503_rls_policies.sql`:**
   - `ENABLE ROW LEVEL SECURITY` en todas las tablas de `public` y `nutricionista`.
   - Políticas estrictas por usuario (`auth.uid() = user_id`) para `quiz_attempts`, `lms_notifications`, `async_jobs` y `pasos_completados`.
   - Políticas de solo lectura para catálogo docente (`documentos`, `tarjetas`) y mutación reservada exclusivamente a `service_role`.
4. **`supabase/RLS_MATRIX.md`:**
   - Tabla completa `Tabla × Rol (anon / authenticated / service_role) × (SELECT / INSERT / UPDATE / DELETE)` + consulta de verificación `SELECT tablename, rowsecurity FROM pg_tables`.

---

### Bloque B — Endpoint `/api/health` y Logging Estructurado JSON (R3.4)

1. **`src/lib/logger.ts`:**
   - Logger estructurado JSON (`info`, `warn`, `error`) con campos estándar: `timestamp`, `level`, `service: "alquimia-nextjs"`, `correlation_id`, `user_id`, `route`, `duration_ms`, `message`, `meta`.
   - Helper `createRequestLogger(request, route)` que extrae/genera `x-correlation-id`.
2. **`cerebro-py/services/json_logger.py`:**
   - `JsonLogFormatter` para `logging` estándar de Python emitiendo JSON por línea en stdout (`timestamp`, `level`, `service: "cerebro-py"`, `correlation_id`, `message`).
3. **`src/app/api/health/route.ts`:**
   - `GET /api/health` con comprobaciones ligeras en paralelo (timeout 2s cada una):
     - `supabase`: ping REST a `${SUPABASE_URL}/rest/v1/` (sin exponer keys).
     - `redis`: `PING` si `UPSTASH_REDIS_REST_URL` está configurado (o `"not_configured"`).
     - `qdrant`: `GET ${QDRANT_URL}/collections` si está configurado (o `"not_configured"`).
     - `cerebro_py`: `GET ${CEREBRO_PY_URL}/health`.
   - Devuelve `200 OK` (`status: "healthy" | "degraded_optional"`) o `503 Service Unavailable` si falla una dependencia crítica configurada, más `version`, `timestamp`, `uptime_s`.

---

### Bloque C — Pirámide de Testing: Vitest + Pytest + Playwright (R3.2)

1. **Vitest (`vitest.config.ts` + `src/__tests__/`):**
   - Instalar `vitest`, `@vitejs/plugin-react` (si aplica a componentes) o entorno `node` para lógica/APIs.
   - Scripts en `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`.
   - Suites unitarias/integración:
     - `src/__tests__/content.test.ts`: parsing de micro-tarjetas (`src/lib/content.ts`).
     - `src/__tests__/contracts.test.ts`: validación Zod `default-deny` de `CerebroRequestSchema` (`src/lib/schemas/cerebro.ts`) y `PresignRequestSchema` (`src/lib/aws/jobContracts.ts`).
     - `src/__tests__/health.test.ts`: `GET /api/health` (respuesta JSON estructurada, modo saludable y degradado sin filtrar secretos) y `logger.ts` (salida JSON parseable con `correlation_id`).
2. **Playwright (`playwright.config.ts` + `e2e/`):**
   - Instalar `@playwright/test` + `npx playwright install chromium`.
   - 3 specs críticas con `page.route` determinista para llamadas externas/LLM:
     1. `e2e/auth-and-dashboard.spec.ts`: acceso a `/login`, redirección/bloqueo de `/admin` sin cookie admin (`401` / pantalla login admin).
     2. `e2e/lesson-and-itinerary.spec.ts`: navegación a `/biblioteca` o `/leccion/...` y flujo de planificación/consulta IA mockeada.
     3. `e2e/quiz-evaluation.spec.ts`: flujo en `/evaluacion` con preguntas mockeadas hasta resultado final.

---

### Bloque D — Pipeline CI/CD en GitHub Actions (R3.3)

- Reestructurar `.github/workflows/`:
  - **`ci.yml`** (en `pull_request` y `push` a `main`) con 4 jobs:
    1. `frontend-quality`: `npm ci` → `npm run lint` (`tsc --noEmit`) → `npm test` (`vitest run`) → `npm run build`.
    2. `python-quality`: `pip install -r cerebro-py/requirements.txt` → `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -v` → `PYTHONPATH=cerebro-py python -m evals.run_evals --mode deterministic`.
    3. `e2e-playwright`: `npm ci` → `npx playwright install --with-deps chromium` → `npm run test:e2e` (sube `playwright-report/` como artefacto si falla).
    4. `infra-validate` (condicional a cambios en `infra/**` o en `main`): `hashicorp/setup-terraform@v3` → `terraform fmt -check` → `terraform init -backend=false` → `terraform validate`.
  - **`deploy.yml`**: mantenido o vinculado tras `ci.yml` en `main`.

---

## 3. Refinamiento Crítico del Plan (3 Ciclos de Self-Refinement)

- **Ciclo 1 (Aislamiento RLS sin romper Admin ni Workers):**
  - *Problema detectado:* Activar RLS en `nutricionista.documentos` o `async_jobs` podría bloquear al panel `/admin` o al worker Lambda si usan `anon` key.
  - *Refinamiento:* Separar explícitamente en `RLS_MATRIX.md` el rol `authenticated` (restringido a `auth.uid() = user_id` en tablas de progreso/jobs) del rol `service_role` (usado únicamente en Route Handlers server-side y Lambda).
- **Ciclo 2 (Tests E2E sin Flakiness ni Dependencia de Red/LLMs):**
  - *Problema detectado:* En CI sin claves de Supabase/LLM reales, los tests Playwright podrían colgarse o fallar por timeouts externos.
  - *Refinamiento:* Usar `page.route('**/api/cerebro', ...)` en Playwright y verificar primero la disponibilidad de rutas públicas/renderizado SSR con fallback determinista.
- **Ciclo 3 (Validación Real de Logs JSON y `/api/health`):**
  - *Problema detectado:* Un `/api/health` que solo devuelve `{ ok: true }` no detecta caídas reales ni valida que los logs sean JSON parseables.
  - *Refinamiento:* Comprobar conectividad real con timeout corto (2s), devolver estado granular por dependencia sin filtrar credenciales y testear con `JSON.parse` la salida real de `logger.ts` y `json_logger.py`.

---

## 4. PACK_CODER & PACK_AUDITOR: Matriz de Verificación

| ID | Criterio | Prueba / Comando de Verificación | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **EV3.1** | 100% tablas con RLS activo | Revisión de `supabase/migrations/2026112503_rls_policies.sql` + `supabase/RLS_MATRIX.md` | Todas las tablas con `ENABLE ROW LEVEL SECURITY` y cero políticas permisivas en datos privados |
| **EV3.2** | Migraciones reproducibles | Validación de orden cronológico e idempotencia (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) en `supabase/migrations/` | Sin conflictos ni errores de sintaxis SQL |
| **EV3.3** | Pirámide unitaria (`Vitest` + `Pytest`) | `npm test` (`vitest run`) + `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -v` | 100% tests verdes |
| **EV3.4** | E2E Playwright estables | `npm run test:e2e` (`playwright test`) | 3/3 specs verdes sin flakiness |
| **EV3.5** | `/api/health` y logs JSON | Test unitario + sondeo `GET /api/health` y verificación `JSON.parse` de logs Node/Python | JSON estructurado con `correlation_id` y estado de dependencias |
| **CI** | Pipeline GitHub Actions válido | Revisión YAML de `.github/workflows/ci.yml` + `npm run lint && npm run build` | Exit code `0` y 4 jobs configurados |

---

## 🗺️ Mapa de Trabajo por Fases (Roadmap)

- [x] **Etapa 1: Migraciones SQL y Políticas RLS (`supabase/`)** — Creados `2026112501_base_tables.sql`, `2026112502_triggers_and_realtime.sql`, `2026112503_rls_policies.sql` y `supabase/RLS_MATRIX.md`.
- [x] **Etapa 2: `/api/health` y Logging Estructurado JSON** — Creados `src/lib/logger.ts`, `src/app/api/health/route.ts` y `cerebro-py/services/json_logger.py`.
- [x] **Etapa 3: Suite Vitest en Next.js** — Instalado `vitest`, configurado `vitest.config.ts` y creados tests en `src/__tests__/` (`content.test.ts`, `contracts.test.ts`, `health.test.ts`).
- [x] **Etapa 4: Suite E2E Playwright (3 Specs Críticas)** — Instalado `@playwright/test` + Chromium, configurado `playwright.config.ts` y creados `e2e/auth-and-dashboard.spec.ts`, `e2e/lesson-and-itinerary.spec.ts` y `e2e/quiz-evaluation.spec.ts`.
- [x] **Etapa 5: Pipeline CI/CD en `.github/workflows/ci.yml`** — Configurados los 4 jobs (`frontend-quality`, `python-quality`, `e2e-playwright`, `infra-validate`).
- [x] **Etapa 6: Ejecución Completa de Pruebas, Auditoría y `CONTEXT.md`** — `vitest` (8/8), `pytest` (33/33), `run_evals` (28/28), `playwright` (3/3), `tsc --noEmit` y `next build --webpack` verdes; `CONTEXT.md` actualizado; pendiente confirmación explícita para `git push`.

---

## ⚙️ Métodos Aplicados (Code Refinement Suite)

- **Clasificación Adaptativa (Nivel 3 — Alta Complejidad):** Se aplicó el protocolo completo `PACK_ARCHITECT ➔ PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR` para blindar Supabase con RLS, construir la pirámide de testing completa y configurar CI/CD + observabilidad JSON.
- **Tree of Thoughts (ToT) + Panel de 3 Expertos (PACK 1):** Se evaluaron alternativas de logger (nativo JSON vs. `pino`), E2E (Playwright con `page.route` determinista vs. LLMs reales) y migraciones SQL cronológicas frente a archivo único.
- **Step-Back + 3 Ciclos de Self-Refinement (PACK 2):** Se refinó la separación `authenticated` vs. `service_role` para no romper `/admin` ni Lambda, el determinismo de Playwright en CI y la verificación real de logs JSON parseables.
- **Chain of Verification (CoVe), TDD y Auditoría RLS (PACK 3 & 4):** Todas las rutas, esquemas y servicios citados fueron verificados en el repositorio real, y el cierre exige pasar `vitest`, `pytest`, `playwright`, `tsc` y `next build` antes de pedir autorización para `git push`.
