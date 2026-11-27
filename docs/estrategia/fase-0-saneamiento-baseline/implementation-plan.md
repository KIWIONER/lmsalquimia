# Implementation Plan — Fase 0: Saneamiento Técnico, Línea Base (Baseline) y Quick Wins (v2)

> **Estrategia asociada:** [`fase-0-saneamiento-baseline.md`](./fase-0-saneamiento-baseline.md)
> **Documento Maestro:** [`CONTEXT.md`](../../../CONTEXT.md)
> **Dominio:** Plataforma EdTech Interactiva de Ciencias de la Salud y Ciencias Exactas (Medicina, Nutrición [vertical piloto], Química, Bioquímica y Física)
> **Decisiones Arquitectónicas Vigentes:** Retirada/deprecación de `n8n` · Adopción de **Qdrant** como Vector DB dedicada · Arquitectura híbrida **Next.js 16 + Supabase + AWS + Redis + Langfuse**
> **Clasificación Code Refinement Suite:** **Nivel 2 — Complejidad Media** (`PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR`)

---

## 1. Resumen Ejecutivo y Diagnóstico Fáctico (Step-Back)

Antes de construir la infraestructura asíncrona en AWS (Fase 1) y la capa de IA observable con **Qdrant** (Fase 2), la Fase 0 cierra la deuda heredada de Astro, marca formalmente el fin de ciclo de **`n8n`** y genera una **línea base cuantitativa real** del rendimiento, coste y estado de recuperación actual.

### Hallazgos verificados en el código fuente actual

1. **Restos legacy de Astro sin uso en `src/`:**
   - `package.json`: conserva `"name": "dimensional-doppler"` y dependencias huérfanas (`astro`, `@astrojs/netlify`, `@astrojs/node`, `@astrojs/react`, `@tailwindcss/vite`, mientras Next.js ya usa `@tailwindcss/postcss`).
   - `astro.config.mjs`: archivo sin referencias activas.
   - `README.md`: plantilla por defecto _"Astro Starter Kit: Minimal"_.
2. **Acoplamiento legacy a `n8n` (ahora oficialmente DEPRECADO):**
   - `integration_test.js` y `config.js`: scripts legacy dedicados exclusivamente al webhook de `n8n` (y `axios` en `devDependencies`, a verificar si tiene algún otro uso).
   - `src/app/api/cerebro/route.ts` y `src/app/api/v1/integrations/n8n/route.ts`: siguen dependiendo de `n8n` como fallback/integración; en Fase 0 se marcan explícitamente como `@deprecated` (sunset planificado en Fases 1–2) sin romper la operación actual para poder medir el _antes_.
3. **Capa vectorial sin conectar (transición hacia Qdrant):**
   - `cerebro-py/services/vectorstore_supabase.py` mantiene los registros únicamente en memoria (`self._memory_store`), sin Vector DB real conectada. Quedará registrado en el baseline como punto de partida previo a la migración a **Qdrant (RAG Híbrido)** en Fases 1–2.
4. **Variables de entorno y CI incompletos:**
   - `.env.example` omite `CEREBRO_PY_URL`, `CEREBRO_PY_HOST`, `CEREBRO_PY_PORT`, `SUPABASE_SERVICE_ROLE_KEY`, no marca `n8n` como deprecado y no prepara el bloque de `QDRANT_*`.
   - `.github/workflows/deploy.yml` ejecuta `npm install` + `npm run build`, pero no corre `npm ci`, ni `npm run lint` (`tsc --noEmit`), ni `pytest cerebro-py/tests/`.

---

## 2. Diseño Técnico por Bloques (Arquitectura de Ejecución)

### Bloque A — Saneamiento de Dependencias Legacy (Astro + Scripts `n8n`) (R0.1)

| Archivo                                                                     | Acción               | Detalle técnico                                                                                                                                                                                                            |
| :-------------------------------------------------------------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                              | Modificar            | Renombrar `"name"` a `"alquimia-lms"`. Eliminar `astro`, `@astrojs/netlify`, `@astrojs/node`, `@astrojs/react` y `@tailwindcss/vite`. Verificar `axios` en `src/`; si tiene 0 referencias, retirarlo de `devDependencies`. |
| `package-lock.json`                                                         | Regenerar            | Ejecutar `npm install` tras editar `package.json` para garantizar determinismo con `npm ci` en GitHub Actions.                                                                                                             |
| `astro.config.mjs`                                                          | Eliminar             | Configuración obsoleta de Astro/Vite.                                                                                                                                                                                      |
| `integration_test.js` & `config.js`                                         | Eliminar             | Scripts legacy acoplados al webhook deprecado de `n8n` (verificando previamente 0 referencias en el repo).                                                                                                                 |
| `src/app/api/cerebro/route.ts` & `src/app/api/v1/integrations/n8n/route.ts` | Anotar `@deprecated` | Añadir cabecera JSDoc `@deprecated` en el bloque de fallback `n8n` indicando retirada definitiva en Fases 1–2 (`cerebro-py` + AWS SQS/Lambda + LLM Router). Sin cambios de comportamiento en Fase 0.                       |

### Bloque B — Script Reproducible de Línea Base Multi-Disciplina (`baseline-metrics.md`) (R0.2)

- **Archivo a crear:** `scripts/benchmark_baseline.mjs` (Node.js 22 nativo con `fetch` y `performance.now()`, cero dependencias externas).
- **Variables configurables:**
  - `TARGET_NEXT_URL` (default `http://127.0.0.1:3000`)
  - `TARGET_CEREBRO_URL` (default `http://127.0.0.1:8055`)
  - `BENCHMARK_RUNS` (default `10`, mínimo exigido por `EV0.4`)
  - `BENCHMARK_PDF_URL` (opcional, para medir `/api/pdf/structure` con un PDF científico real)
- **Escenarios representativos del nuevo dominio científico:**
  1. **Quiz adaptativo (`POST /api/cerebro`, `action: "generate_quiz"`):** generación de 5 preguntas de dificultad 5 sobre Nutrición Clínica (vertical piloto).
  2. **Chat tutor multi-disciplina (`POST /api/cerebro`):** 3 prompts reales que cubren las ramas objetivo de Alquimia LMS:
     - _Nutrición / Medicina Clínica:_ dosificación de micronutrientes y requerimientos diarios (`mg`, `µg`, `kcal`).
     - _Química / Bioquímica:_ balance energético/estequiometría metabólica (glucólisis / `mol`, `ATP`).
     - _Física aplicada a ciencias de la salud:_ presión hidrostática / hemodinámica o leyes de gases (`mmHg`, `Pa`, `m/s²`).
  3. **Extracción PDF pesada (`POST /api/pdf/structure` en `cerebro-py`):** medición de latencia y estabilidad en extracción síncrona actual (si se provee `BENCHMARK_PDF_URL`).
- **Métricas calculadas y volcadas en `docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md`:**
  - `p50`, `p95`, `p99` y media (ms) por escenario.
  - Tasa de éxito `2xx` vs. tasa de timeout / error `503` (evidenciando el techo actual de 8s/15s).
  - Estimación de tokens aproximados (`chars / 4`) y coste estimado por sesión de estudio (base para comparar el ahorro con Redis + Langfuse en Fase 2).
  - Foto del estado actual de retrieval: **0% Vector DB persistente** (`_memory_store` en `vectorstore_supabase.py`), línea base previa a **Qdrant**.

### Bloque C — `.env.example` Actualizado y CI/CD Quick Win (R0.3)

- **`.env.example`:** Reorganizado en bloques claros sin secretos reales:
  1. **Supabase (Auth SSR, Relacional, Realtime):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
  2. **Cerebro Python Core:** `CEREBRO_PY_URL=http://127.0.0.1:8055`, `CEREBRO_PY_HOST=127.0.0.1`, `CEREBRO_PY_PORT=8055`.
  3. **Qdrant Vector DB (Preparado para Fases 1–2):** `QDRANT_URL=http://127.0.0.1:6333`, `QDRANT_API_KEY=`, `QDRANT_COLLECTION=alquimia_ciencia`.
  4. **Autenticación Admin & Seguridad M2M:** `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `ALQUIMIA_BACKEND_API_KEY`, `SUPABASE_WEBHOOK_SECRET`.
  5. **`[LEGACY / DEPRECADO — Retirada en Fases 1–2]` n8n:** `N8N_CEREBRO_URL`, `N8N_SECRET_TOKEN`.
- **`.github/workflows/deploy.yml`:**
  - Añadir trigger `pull_request` sobre `main`.
  - Job `build-nextjs`: `npm ci` → `npm run lint` (`tsc --noEmit`) → `npm run build`.
  - Job paralelo `test-cerebro-py`: `actions/setup-python@v5` (Python `3.12`, caché `pip`) → `pip install -r cerebro-py/requirements.txt` → `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -v`.

### Bloque D — Reescritura Inicial de `README.md` (v1) (R0.4)

- Sustituir la plantilla de Astro por una portada técnica v1 alineada 100% con `CONTEXT.md`:
  1. **Presentación y Dominio:** Alquimia LMS — Plataforma EdTech interactiva para Medicina, Nutrición (vertical piloto), Química, Bioquímica y Física.
  2. **Arquitectura Actual vs. Evolución (Mermaid):** Next.js 16 + Supabase SSR + `cerebro-py` (y evolución planificada hacia **AWS S3/SQS/Lambda + Terraform + Qdrant RAG Híbrido + Redis + Langfuse**, con deprecación total de `n8n`).
  3. **Stack Tecnológico Real** (sin referencias a Astro).
  4. **Quickstart Local:** Node >= 22, Python 3.12, `.env.example` → `.env.local`, arranque unificado (`npm run setup:py` + `npm run dev:all`) y comandos de verificación (`npm run lint`, `npm run build`, `pytest`).
  5. **Roadmap de Arquitectura (Fases 0–4):** tabla con enlaces directos a `CONTEXT.md` y a las estrategias en `docs/estrategia/`.

### Bloque E — Arranque Local Reproducible y Multiplataforma (R0.5)

- **Archivos:** `scripts/setup_python.mjs`, `scripts/dev_local.mjs` y scripts en `package.json` (`setup:py`, `dev:py`, `dev:all`).
- **Requisitos técnicos:**
  1. **Cero dependencias npm extra:** implementación en Node.js nativo (`node:child_process`, `node:fs`, `node:path`).
  2. **Entorno Python determinista:** `npm run setup:py` crea `cerebro-py/.venv` si no existe e instala `cerebro-py/requirements.txt`.
  3. **Orquestación unificada:** `npm run dev:all` resuelve `cerebro-py/.venv` automáticamente (con fallback y aviso si se usa Python global), invoca `python -m uvicorn --host 127.0.0.1 --port 8155 --reload main:app` (opciones antes del argumento posicional `APP` para compatibilidad con `uvicorn`/`click` en Windows y Unix), levanta `next dev -p 3100` (con detección automática de colisiones IPv4/IPv6), prefija logs (`[cerebro-py]`, `[next]`) y termina ambos árboles de procesos al salir (`SIGINT`/`SIGTERM`).

---

## 3. Refinamiento Crítico del Plan (3 Ciclos de Self-Refinement)

- **Ciclo 1 (Alineación con el nuevo dominio y Qdrant):** Se actualizó el diseño del benchmark (`scripts/benchmark_baseline.mjs`) para que los prompts de prueba cubran Medicina/Nutrición, Química/Bioquímica y Física (y no solo nutrición), y se incorporó el bloque `QDRANT_*` en `.env.example` y la fotografía de estado base del vectorstore (`_memory_store`) en `baseline-metrics.md`.
- **Ciclo 2 (Transición segura de `n8n` sin regresiones):** En lugar de eliminar el fallback de `n8n` en `src/app/api/cerebro/route.ts` antes de tener el LLM Router (Fase 2), se eliminan los scripts muertos (`integration_test.js`, `config.js`), se marca explícitamente como `@deprecated` en código y `.env.example`, y se mide su tasa real de latencia/timeout en el baseline para justificar su retirada con datos en el ADR de Fase 4.
- **Ciclo 3 (Determinismo en CI y limpieza de Tailwind/Astro):** Se confirmó que `@tailwindcss/vite` solo era consumido por `astro.config.mjs` (Next.js usa `@tailwindcss/postcss`), por lo que se retira junto con `astro` y se regenera `package-lock.json` para que `npm ci` pase limpio en GitHub Actions, junto con `PYTHONPATH=cerebro-py` para `pytest`.

---

## 4. Matriz de Verificación y Auditoría (PACK 3 & PACK 4)

| ID Estrategia | Criterio                                | Comando / Prueba de Verificación                                                                                    | Resultado Esperado                                                                                  |
| :------------ | :-------------------------------------- | :------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| **EV0.1**     | Cero restos de Astro ni scripts muertos | Búsqueda global de `astro`, `config.js`, `integration_test.js` en `package.json` y `src/`; verificar borrado físico | 0 coincidencias activas                                                                             |
| **EV0.2**     | Compilación y tipos Next.js             | `npm ci && npm run lint && npm run build`                                                                           | Exit code `0`, 0 errores TS/CSS                                                                     |
| **EV0.3**     | Tests Python en local y CI              | `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -v` + validación YAML de `.github/workflows/deploy.yml`             | 100% tests verdes                                                                                   |
| **EV0.4**     | Baseline multi-disciplina cuantitativo  | `node scripts/benchmark_baseline.mjs` → revisar `docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md`   | Tabla completa (`n >= 10`) con p50/p95/p99, tasa de timeout, coste estimado y estado base vectorial |
| **EV0.5**     | Portada técnica `README.md` v1          | Revisar alineación con `CONTEXT.md` (Medicina/Nutrición/Química/Física, Qdrant, deprecación `n8n`, enlaces válidos) | Aprobado                                                                                            |
| **EV0.6**     | Arranque local reproducible (`dev:all`) | `npm run setup:py` + `npm run dev:all` y sondeo de `http://localhost:3100` y `http://127.0.0.1:8155/health`         | Ambos servicios responden `200 OK` y cierran limpiamente                                            |
| **AUD-SEC**   | Auditoría ligera de secretos            | Inspeccionar `git diff`, `.env.example` y `.github/workflows/deploy.yml`                                            | 0 secretos reales filtrados                                                                         |

---

## 🗺️ Mapa de Trabajo por Fases (Roadmap)

### Etapa 1 — Saneamiento de Dependencias Legacy (Astro + Scripts `n8n`)

- [x] Verificar con búsqueda global que `src/`, `cerebro-py/` y `.github/` no importan `astro`, `@astrojs/*`, `@tailwindcss/vite`, `axios`, `config.js` ni `integration_test.js`.
- [x] Actualizar `package.json` (`"name": "alquimia-lms"` y retirada de dependencias legacy) y regenerar `package-lock.json`.
- [x] Eliminar `astro.config.mjs`, `integration_test.js` y `config.js`.
- [x] Anotar `@deprecated` en los bloques de `n8n` en `src/app/api/cerebro/route.ts` y `src/app/api/v1/integrations/n8n/route.ts`.
- [x] Validar compilación limpia con `npm run lint` (`tsc --noEmit`) y `npm run build`.

### Etapa 2 — Variables de Entorno (`.env.example`) y CI/CD Quick Win

- [x] Actualizar `.env.example` con bloques de Supabase, `cerebro-py`, Qdrant (preparado para Fases 1–2), Admin/M2M y bloque `n8n` marcado como `[LEGACY / DEPRECADO]`.
- [x] Actualizar `.github/workflows/deploy.yml` con trigger `pull_request`, `npm ci`, `npm run lint`, `npm run build` y job paralelo `test-cerebro-py` (`pytest`).
- [x] Ejecutar `pytest cerebro-py/tests/ -v` en local para verificar 100% de tests en verde.

### Etapa 3 — Captura de Línea Base Multi-Disciplina (Baseline)

- [x] Implementar `scripts/benchmark_baseline.mjs` cubriendo Quiz Nutrición, 3 prompts científicos (Medicina/Nutrición, Química/Bioquímica, Física) y extracción PDF opcional en `cerebro-py`.
- [x] Ejecutar el benchmark (`n >= 10`) contra Next.js + `cerebro-py` en local.
- [x] Generar y verificar `docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md` (incluyendo estado inicial del vectorstore en memoria previo a Qdrant).

### Etapa 4 — Arranque Local Reproducible, Portada Técnica (`README.md` v1) y Auditoría Final

- [x] Implementar `scripts/setup_python.mjs`, `scripts/dev_local.mjs` y los scripts `setup:py`, `dev:py` y `dev:all` en `package.json` para levantar Next.js + `cerebro-py` de forma limpia y multiplataforma.
- [x] Reescribir `README.md` alineado con `CONTEXT.md` (dominio científico ampliado, arquitectura actual vs. objetivo con Qdrant + AWS + Redis + Langfuse, retirada de `n8n`, Quickstart unificado y enlaces al Roadmap).
- [x] Ejecutar auditoría final (`PACK_AUDITOR`): comprobar `EV0.1`–`EV0.6`, cero secretos en `git diff` y estado limpio del repositorio.
- [x] Presentar resumen de cambios y resultados al usuario y solicitar confirmación explícita antes de cualquier `git push`.

---

## ⚙️ Métodos Aplicados (Code Refinement Suite)

- **Clasificación Adaptativa (Nivel 2 — Complejidad Media):** Se mantiene el protocolo `PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR`, ajustado al alcance de saneamiento, deprecación controlada de `n8n`, CI/CD inicial y medición de baseline multi-disciplina.
- **Step-Back Prompting (`PACK_PLANNER`):** Se re-evaluó el estado fáctico del repositorio frente a las nuevas decisiones de `CONTEXT.md` (dominio científico ampliado, adopción de Qdrant y deprecación de `n8n`) para evitar discrepancias entre código, `.env.example` y documentación.
- **Self-Refinement Loop en 3 Ciclos (`PACK_PLANNER`):** Refinado en 3 iteraciones para incorporar prompts científicos multi-disciplina en el benchmark, transición segura de `n8n` mediante `@deprecated` sin romper el baseline actual, y determinismo de `npm ci` + `PYTHONPATH` en CI.
- **Chain of Verification — CoVe (`PACK_CODER`):** Cada retirada de dependencia o archivo y cada ajuste de CI se verificará contra el código real y mediante ejecución directa de `npm ci`, `npm run lint`, `npm run build` y `pytest`.
- **Auditoría Ligera y Regla Inviolable de Git (`PACK_AUDITOR`):** Al cerrar la ejecución se auditarán `EV0.1`–`EV0.5` y ausencia de secretos en `git diff`, deteniéndonos antes de cualquier `git push` para pedir confirmación explícita al usuario.
