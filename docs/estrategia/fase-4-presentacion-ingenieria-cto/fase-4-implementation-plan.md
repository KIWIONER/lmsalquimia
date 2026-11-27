# Implementation Plan — Fase 4: Presentación de Ingeniería, Trade-offs y Métricas (CTO-Ready)

> **Estrategia asociada:** [`fase-4-presentacion-ingenieria-cto.md`](./fase-4-presentacion-ingenieria-cto.md)
> **Documento Maestro:** [`CONTEXT.md`](../../../CONTEXT.md)
> **Dominio:** Plataforma EdTech Interactiva de Ciencias de la Salud y Ciencias Exactas (Medicina, Nutrición, Química, Bioquímica y Física)
> **Clasificación Code Refinement Suite:** **Nivel 3 — Cierre Arquitectónico y Verificación Integral** (`PACK_ARCHITECT ➔ PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR`)

---

## 1. PACK_ARCHITECT: Ideación Técnica (Tree of Thoughts + 3 Expertos)

### Diagnóstico Fáctico de Partida (Verificado en el Codebase)
1. **Estado real de `README.md`:**
   - Aunque la guía estratégica mencionaba inicialmente una plantilla de Astro, el archivo raíz [`README.md`](../../../README.md) ya fue actualizado en la Fase 0 a una versión v1 (90 líneas).
   - **Brecha actual:** Describe todavía el estado *As-Is* previo a las Fases 1–3 (marca AWS, Qdrant, Redis y Langfuse como `Fase 1-2: Target`), carece de badges reales de GitHub Actions, no incluye tabla comparativa *Antes vs. Después*, no enlaza ADRs ni evidencias visuales (`docs/assets/`), y tampoco documenta los comandos de testing de Fase 3 (`npm test`, `npm run test:e2e`, `evals.run_evals`, `terraform validate`).
2. **Estado real de `CONTEXT.md` y documentación estratégica:**
   - [`CONTEXT.md`](../../../CONTEXT.md) está actualizado hasta la Fase 3 (`Implementada (local)`) y mantiene la Fase 4 como `Pendiente`.
   - No existe aún el directorio `docs/architecture/` ni `docs/architecture/decisions.md` (ADRs), ni `docs/assets/` con capturas verificables.
3. **Evidencias y métricas reales ya disponibles en el repo:**
   - **Baseline Fase 0 ([`baseline-metrics.md`](../fase-0-saneamiento-baseline/baseline-metrics.md)):** Capturado el `2026-11-24T16:38:14.712Z` (`n = 10`). Registra `0%` persistencia Vector DB (solo `_memory_store`), `0%` caché Redis, `0%` trazabilidad Langfuse, `0%` suite Evals y ejecución 100% síncrona (corte 8s en `cerebro-py` / 15s en `n8n` legacy).
   - **Evals deterministas ([`cerebro-py/evals/last_report.json`](../../../cerebro-py/evals/last_report.json)):** `28/28` casos superados (`pass_rate: 1.0`, `contract_and_guardrail_pass_rate: 1.0`, `gate_passed: true`).
   - **CI/CD ([`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)):** Workflow `CI Quality Gate — Alquimia LMS` con 4 jobs (`frontend-quality`, `python-quality`, `e2e-playwright`, `infra-validate`).
   - **Infraestructura ([`infra/`](../../../infra/main.tf)):** Terraform modular (`main.tf`, `iam.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `README.md`).

### Comparativa Tree of Thoughts (ToT) — Estructura de Presentación CTO-Ready

| Eje | Alternativa A | Alternativa B (Seleccionada) | Alternativa C | Decisión |
| :--- | :--- | :--- | :--- | :--- |
| **Organización Documental** | Todo el detalle técnico y ADRs dentro de `README.md` | **`README.md` ejecutivo (< 3 min lectura) + [`docs/architecture/decisions.md`](../../../docs/architecture/decisions.md)** con los 6 ADRs | Solo enlaces a los planes de Fases 0–3 | **B:** Mantiene el `README.md` escaneable en 2–3 minutos para un CTO/EM y delega la profundidad de trade-offs a un documento ADR dedicado. |
| **Evidencias Visuales (`docs/assets/`)** | Mockups o diagramas sintéticos dibujados a mano | **Capturas reales de ejecución local/CI + salidas verificables** (UI, suite Evals/CI, `terraform plan`, Langfuse o modo degradado honesto) | Solo texto sin imágenes | **B:** Aporta prueba visual verificable sin inventar datos; si un servicio cloud opcional (p. ej. Langfuse remoto) no tiene credenciales activas en el momento de captura, se documenta con honestidad qué está capturado en local/CI y cómo reproducirlo en cloud. |
| **Métricas *Antes vs. Después*** | Estimaciones genéricas de industria | **Tabla trazable 100% a [`baseline-metrics.md`](../fase-0-saneamiento-baseline/baseline-metrics.md), `last_report.json`, `vitest`/`pytest`/`playwright` y `benchmark_baseline.mjs`** | Omitir números para evitar comparaciones | **B:** Cumple `EV4.3` (cero datos inventados; cada cifra cita su fuente exacta en el repositorio). |

### Dictamen del Panel de 3 Expertos
- **UX / Technical Recruiter Specialist:** El primer pantallazo del `README.md` debe responder en 30 segundos qué problema resuelve Alquimia LMS, mostrar badges reales de CI, el diagrama Mermaid de arquitectura completa y una tabla *Antes vs. Después* clara. El resto debe guiar en menos de 3 minutos hacia los ADRs y el Quickstart reproducible.
- **Dev Lead:** Cada comando documentado en el Quickstart (`npm ci`, `npm run setup:py`, `npm run dev:all`, `npm run lint`, `npm test`, `npm run test:e2e`, `pytest`, `python -m evals.run_evals --mode deterministic`, `terraform fmt -check`, `terraform validate`) debe ejecutarse y verificarse contra `package.json`, `cerebro-py/` e `infra/` para garantizar cero comandos rotos (`EV4.2`).
- **Security Specialist (Sec):** Antes de guardar cualquier captura o snippet de salida en `docs/assets/` o en `README.md`, auditar que no contenga tokens, URLs con credenciales, emails reales, `SUPABASE_SERVICE_ROLE_KEY`, claves de AWS ni datos sensibles de `.env.local`.

---

## 2. PACK_PLANNER: Diseño por Bloques

### Bloque A — Registro de Decisiones de Arquitectura (`docs/architecture/decisions.md`) (R4.2)

Crear [`docs/architecture/decisions.md`](../../../docs/architecture/decisions.md) con índice escaneable y **6 ADRs** en formato estándar (**Contexto → Decisión → Alternativas descartadas → Trade-offs asumidos → Evidencia en el repo**):

1. **ADR-001 — Procesamiento asíncrono con AWS S3 + SQS/DLQ + Lambda Python frente a Next.js API Routes síncronas:**
   - *Contexto:* Timeouts de 8s (`cerebro-py`) / 15s (`n8n`) en tareas pesadas de PDFs/ETL.
   - *Trade-off:* Se elimina el bloqueo HTTP y se gana reintento + DLQ, a cambio de mayor complejidad de máquina de estados (`async_jobs` en Supabase) y polling/Realtime en UI.
   - *Evidencia:* `infra/main.tf`, `src/app/api/jobs/`, `src/lib/aws/jobContracts.ts`, `cerebro-py/services/job_repository.py`.
2. **ADR-002 — Arquitectura híbrida (Supabase + AWS + Vercel/Next.js) frente a 100% AWS o 100% Supabase:**
   - *Contexto:* Necesidad de Auth SSR + RLS + Realtime rápido sin renunciar a workers Python e IaC estándar.
   - *Trade-off:* Velocidad de entrega y DX en Auth/DB vs. gestión de dos planos de credenciales, CORS/presign y sincronización de estado entre AWS Lambda y Supabase PostgreSQL.
   - *Evidencia:* `src/lib/supabase/`, `supabase/migrations/`, `infra/iam.tf`.
3. **ADR-003 — Control de costes y resiliencia LLM: Redis (caché + rate limit) + LLM Router con fallback + Langfuse:**
   - *Contexto:* 0% caché y 0% trazabilidad en Fase 0.
   - *Trade-off:* Latencia extra mínima de red hacia Upstash y dependencia de proveedor externo (mitigada con degradación elegante si Redis/Langfuse no están configurados) a cambio de evitar abuso por usuario, controlar presupuesto y medir coste/latencia por traza.
   - *Evidencia:* `src/lib/redis/client.ts`, `src/lib/redis/rateLimiter.ts`, `cerebro-py/services/llm_router.py`, `cerebro-py/services/observability.py`.
4. **ADR-004 — Guardrails deterministas + Contratos Zod/Pydantic + Suite de 28 Evals frente a solo Prompt Engineering:**
   - *Contexto:* Dominio científico/clínico con tolerancia cero a alucinaciones de dosis (`mg`, `µg`, `UI`, `kcal`, `mol/L`).
   - *Trade-off:* Rigidez en los formatos de salida (requiere mantener esquemas y dataset de Evals al añadir features) a cambio de bloqueo determinista en CI (`gate_passed: true`) y seguridad clínica verificable.
   - *Evidencia:* `src/lib/schemas/cerebro.ts`, `cerebro-py/services/guardrails.py`, `cerebro-py/evals/eval_dataset.jsonl`, `cerebro-py/evals/run_evals.py`.
5. **ADR-005 — Amazon S3 con Presigned URLs frente a proxy de archivos a través de Next.js:**
   - *Contexto:* Subida y descarga de PDFs técnicos pesados sin saturar memoria ni ancho de banda del BFF.
   - *Trade-off:* Requiere configuración de CORS en el bucket S3 y expiración corta de URLs firmadas, además de validación estricta de MIME/tamaño previa en `/api/storage/presign`.
   - *Evidencia:* `src/app/api/storage/presign/route.ts`, `src/lib/aws/clients.ts`, `infra/main.tf`.
6. **ADR-006 — Qdrant (Vector DB dedicada con búsqueda híbrida densa + dispersa) frente a `pgvector` en Supabase:**
   - *Contexto:* En Fase 0 el RAG operaba en memoria (`_memory_store`); la terminología científica/médica mezcla semántica y códigos/unidades exactas (`µg`, `ATP`, `Poiseuille`).
   - *Trade-off:* Añade un servicio de persistencia adicional y exige sincronización idempotente mediante doble hash (`hash_manager.py`), a cambio de aislar la carga vectorial del PostgreSQL transaccional (OLTP), obtener búsqueda híbrida nativa y filtrar rápido por payload (`rama`, `asignatura`, `página`).
   - *Evidencia:* `cerebro-py/services/vector_repository.py`, `cerebro-py/services/hash_manager.py`.

---

### Bloque B — Evidencias Empíricas (*Antes vs. Después*) y Capturas en `docs/assets/` (R4.1.4 + R4.3)

1. **Recopilación verificable de métricas reales (sin estimaciones inventadas):**
   - Ejecutar la batería completa local para recoger cifras exactas y actualizadas:
     - `npm run lint` (`tsc --noEmit`)
     - `npm test` (`vitest run`)
     - `PYTHONPATH=cerebro-py pytest cerebro-py/tests/ -v`
     - `PYTHONPATH=cerebro-py python -m evals.run_evals --mode deterministic`
     - `npm run test:e2e` (`playwright test`)
     - `terraform fmt -check` y `terraform validate` (en `infra/`, si `terraform` está disponible en el entorno).
   - Contrastar contra [`docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md`](../fase-0-saneamiento-baseline/baseline-metrics.md) para construir la tabla comparativa *Antes (Fase 0) vs. Después (Fases 1–3)*:
     - Ejecución pesada: Síncrona (corte 8s/15s, fallback `n8n`) → Asíncrona desacoplada (`202 Accepted` + SQS/DLQ + Lambda + `n8n` retirado).
     - Capa vectorial RAG: `0%` persistencia (`_memory_store` en memoria) → Qdrant híbrido (denso + disperso) con doble hash idempotente.
     - Seguridad de datos (RLS): Sin RLS activo en `schema.sql` → `100%` tablas con RLS (`ENABLE ROW LEVEL SECURITY`) + `RLS_MATRIX.md` + migraciones cronológicas.
     - Testing y CI Gate: 0 tests JS/E2E y 0 Evals → Vitest + Pytest + 3 specs Playwright + 28/28 Evals deterministas (`100%` pass rate) en `.github/workflows/ci.yml`.
     - Observabilidad y Salud: `0%` trazas / sin `/api/health` → Logger JSON con `correlation_id` (Next.js + Python), `/api/health` multi-dependencia y trazabilidad Langfuse instrumentada.
     - FinOps AWS: Infraestructura declarada en Terraform (`infra/`) dimensionada para Free Tier (0–2 €/mes objetivo).
2. **Material visual en `docs/assets/`:**
   - Generar/capturar en `docs/assets/` al menos 3–4 evidencias reales y limpias (sin datos sensibles):
     - `docs/assets/ui-dashboard-leccion.png` (captura real de la app levantada en local, p. ej. dashboard/lección o quiz).
     - `docs/assets/evals-ci-output.png` o bloque de evidencia verificable de la suite de Evals (`28/28`) + tests (`vitest`, `pytest`, `playwright`).
     - `docs/assets/langfuse-trace.png` (captura real de Langfuse si hay instancia/credenciales configuradas, o captura/evidencia de la traza JSON estructurada + `/api/health` si se ejecuta en modo local sin credenciales remotas).
     - `docs/assets/terraform-infra.png` (output real de `terraform validate` / `terraform plan` o resumen de recursos en `infra/`).

---

### Bloque C — `README.md` Técnico Definitivo (R4.1)

Reescribir [`README.md`](../../../README.md) manteniendo claridad y escaneabilidad (< 3 minutos de lectura) con las secciones obligatorias:
1. **Cabecera ejecutiva + Badges reales:**
   - Badge de GitHub Actions apuntando a `.github/workflows/ci.yml` (`CI Quality Gate — Alquimia LMS`), badges de stack (`Next.js 16`, `Python 3.12`, `Supabase`, `AWS + Terraform`, `Qdrant`).
2. **Problema que resuelve y dominio:**
   - EdTech de Ciencias de la Salud y Ciencias Exactas (Nutrición y Dietética como vertical piloto, Medicina, Química, Bioquímica, Física) con tolerancia cero a alucinaciones numéricas/clínicas.
3. **Diagrama de Arquitectura Completo (Mermaid):**
   - Flujo unificado `Next.js 16 App Router ↔ Supabase (Auth/RLS/Realtime) ↔ Redis (Upstash) ↔ AWS (S3 Presigned / SQS + DLQ / Lambda Python) ↔ Qdrant (RAG Híbrido) ↔ LLM Router (Fallback + Guardrails) ↔ Langfuse`.
4. **Métricas Reales (*Antes vs. Después*):**
   - Tabla comparativa con enlace directo a [`baseline-metrics.md`](../fase-0-saneamiento-baseline/baseline-metrics.md) y [`cerebro-py/evals/last_report.json`](../../../cerebro-py/evals/last_report.json).
5. **Decisiones Técnicas y Trade-offs (Resumen + Enlace a ADRs):**
   - Tabla resumen de los 6 ADRs con enlace a [`docs/architecture/decisions.md`](../../../docs/architecture/decisions.md).
6. **Evidencias Visuales:**
   - Galería compacta enlazando las imágenes de `docs/assets/` (usando rutas relativas que rendericen en GitHub).
7. **Quickstart Reproducible (Local, Tests y Terraform):**
   - Comandos exactos verificados en `package.json`, `cerebro-py/` e `infra/`:
     - Setup inicial (`cp .env.example .env.local`, `npm ci`, `npm run setup:py`).
     - Arranque local (`npm run dev:all` → `http://localhost:3100` y `http://127.0.0.1:8155/health`).
     - Validación completa (`npm run lint`, `npm test`, `npm run build`, `pytest`, `evals.run_evals --mode deterministic`, `npm run test:e2e`, `terraform fmt -check && terraform validate`).
8. **Roadmap de Ingeniería (Fases 0–4 Completadas):**
   - Tabla actualizada con enlaces a todas las estrategias e implementation plans.

---

### Bloque D — Sincronización Documental y Auditoría Final (`CONTEXT.md` + Enlaces) (EV4.2, EV4.5)

1. Actualizar [`CONTEXT.md`](../../../CONTEXT.md):
   - Cambiar el estado de la Fase 4 en la Sección 5 a **Completada** (o **Implementada (local)** según corresponda al estado de push/despliegue) y enlazar `fase-4-implementation-plan.md` y `docs/architecture/decisions.md`.
   - Añadir `docs/architecture/` y `docs/assets/` al mapa del repositorio (Sección 4) y reflejar que el estado *As-Is* ya integra la arquitectura implementada en las Fases 1–3.
2. Verificar que todos los enlaces relativos en `README.md`, `CONTEXT.md` y `docs/architecture/decisions.md` apuntan a archivos existentes (0 enlaces rotos).

---

## 3. Refinamiento Crítico del Plan (3 Ciclos de Self-Refinement)

- **Ciclo 1 (Cero "Vaporware" y Cero Métricas Inventadas):**
  - *Problema detectado:* Es tentador poner porcentajes ficticios de "90% cache hit" o "0.02 €/mes medidos" si no se ha ejecutado tráfico real en producción.
  - *Refinamiento:* En la tabla *Antes vs. Después*, distinguir estrictamente entre: (a) **métricas medidas en local/CI** (`28/28` Evals, `vitest`, `pytest`, `playwright`, `baseline-metrics.md`), (b) **capacidades arquitectónicas verificadas en código** (cola SQS/DLQ, RLS 100%, Qdrant híbrido, retirada de `n8n`) y (c) **objetivos instrumentados** (Langfuse/FinOps en AWS Free Tier) cuando dependan de credenciales cloud externas.
- **Ciclo 2 (Coherencia de Comandos Multiplataforma y Puertos):**
  - *Problema detectado:* En `baseline-metrics.md` aparecen puertos antiguos de Fase 0 (`3000`/`8055`) mientras que `package.json` y `README.md` actual usan `3100` y `8155`.
  - *Refinamiento:* Documentar explícitamente en el Quickstart los puertos reales actuales (`3100` y `8155` definidos en `package.json` y `scripts/dev_local.mjs`) y aclarar la nota histórica de Fase 0 si se referencia `baseline-metrics.md`.
- **Ciclo 3 (Seguridad en Capturas y Badges de GitHub):**
  - *Problema detectado:* Capturas de pantalla del navegador o consola podrían mostrar variables de `.env.local`, IDs de proyecto privados o URLs internas, o usar un `<owner>/<repo>` incorrecto en el badge de GitHub Actions.
  - *Refinamiento:* Inspeccionar `git remote -v` antes de redactar la URL del badge de CI en `README.md` y revisar cada imagen en `docs/assets/` antes de incluirla.

---

## 4. PACK_CODER & PACK_AUDITOR: Matriz de Verificación

| ID | Criterio | Prueba / Comando de Verificación | Resultado Esperado |
| :--- | :--- | :--- | :--- |
| **EV4.1** | Test de lectura rápida (< 3 min) | Lectura estructurada de `README.md` (cabecera, diagrama, métricas, ADRs, quickstart) | Comprensión completa sin abrir `src/` |
| **EV4.2** | Coherencia 100% con el código real | Ejecutar cada comando del Quickstart (`npm run lint`, `npm test`, `npm run build`, `pytest`, `evals.run_evals`, `npm run test:e2e`) + revisar diagrama vs. archivos reales | 0 comandos rotos, 0 cajas ficticias |
| **EV4.3** | Métricas trazables y honestas | Cruce de cifras en `README.md` contra `baseline-metrics.md`, `last_report.json` y salidas de test | 100% cifras respaldadas por archivos/ejecuciones reales |
| **EV4.4** | Trade-offs con criterio senior/mid | Revisión de los 6 ADRs en `docs/architecture/decisions.md` | Cada ADR detalla explícitamente qué se sacrifica o complica |
| **EV4.5** | Limpieza documental y seguridad | Script/comprobación de enlaces internos en Markdown + revisión de `docs/assets/` y `CONTEXT.md` | 0 enlaces rotos, 0 secretos expuestos |

---

## 🗺️ Mapa de Trabajo por Fases (Roadmap)

- [x] **Etapa 1: Redacción de ADRs (`docs/architecture/decisions.md`)** — Documentados los 6 ADRs críticos (SQS+Lambda vs. síncrono, Híbrido Supabase+AWS, Redis+Router+Langfuse, Guardrails+Evals, S3 Presigned URLs, Qdrant vs. `pgvector`) con trade-offs explícitos y referencias reales al código.
- [x] **Etapa 2: Recolección de Métricas Reales y Evidencias Visuales (`docs/assets/`)** — Ejecutada la suite completa (`tsc --noEmit`, `vitest` 8/8, `pytest` 33/33, `evals` 28/28, `playwright` 3/3) y generadas las 3 capturas limpias en `docs/assets/`.
- [x] **Etapa 3: Redacción del `README.md` Definitivo (CTO-Ready)** — Actualizado el `README.md` raíz con badges de CI reales, diagrama Mermaid completo, tabla *Antes vs. Después*, resumen de ADRs, galería de `docs/assets/` y Quickstart reproducible.
- [x] **Etapa 4: Sincronización de `CONTEXT.md` y Auditoría Final** — Actualizado `CONTEXT.md` (estado Fase 4 y mapa del repo), verificados todos los enlaces internos sin secretos expuestos y pendiente confirmación explícita para `git push`.

---

## ⚙️ Métodos Aplicados (Code Refinement Suite)

- **Clasificación Adaptativa (Nivel 3 — Cierre Arquitectónico):** Se aplica el ciclo completo `PACK_ARCHITECT ➔ PACK_PLANNER ➔ PACK_CODER ➔ PACK_AUDITOR` para asegurar que la presentación final de ingeniería tenga el mismo rigor fáctico que el código de las Fases 1–3.
- **Tree of Thoughts (ToT) + Panel de 3 Expertos (PACK 1):** Se evaluó la separación entre `README.md` ejecutivo y `docs/architecture/decisions.md`, el formato honesto de evidencias en `docs/assets/` y la trazabilidad de métricas.
- **Step-Back + 3 Ciclos de Self-Refinement (PACK 2):** Se refinó el plan para evitar métricas inventadas ("vaporware"), alinear puertos reales (`3100`/`8155`) y validar el remoto de Git y la ausencia de secretos en capturas.
- **Chain of Verification (CoVe) y Auditoría Pre-Push (PACK 3 & 4):** Cada comando, ruta, badge y métrica del `README.md` y los ADRs se contrastará ejecutando los checks reales del repositorio y validando enlaces antes de pedir autorización para `git push`.
