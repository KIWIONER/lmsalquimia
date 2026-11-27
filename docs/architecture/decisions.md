# Registro de Decisiones de Arquitectura (ADRs) — Alquimia LMS

> **Propósito:** Documentar las decisiones técnicas críticas de las Fases 0–3 en formato ADR ligero (**Contexto → Decisión → Alternativas descartadas → Trade-offs → Evidencia en el repositorio**).
> **Regla de rigor:** Cada decisión justifica no solo lo que aporta, sino explícitamente **qué complejidad o coste introduce**.

---

## Índice de Decisiones

| ID | Decisión | Área | Estado |
| :--- | :--- | :--- | :--- |
| **ADR-001** | Procesamiento asíncrono con AWS SQS/DLQ + Lambda frente a HTTP síncrono | Backend / AWS | Implementado |
| **ADR-002** | Arquitectura híbrida (Next.js + Supabase + AWS) frente a monocloud | Arquitectura Global | Implementado |
| **ADR-003** | Control de costes IA: Redis + LLM Router con fallback + Langfuse | AI FinOps & Resiliencia | Implementado |
| **ADR-004** | Guardrails deterministas + Pydantic/Zod + Evals frente a solo Prompting | Seguridad Clínica / IA | Implementado |
| **ADR-005** | Amazon S3 con Presigned URLs frente a proxy de archivos en Next.js | Almacenamiento / BFF | Implementado |
| **ADR-006** | Qdrant (RAG híbrido denso + disperso) frente a `pgvector` en Supabase | Recuperación Vectorial | Implementado |

---

## ADR-001 — Procesamiento asíncrono con AWS SQS + DLQ + Lambda frente a Next.js API Routes síncronas

- **Contexto:** En la línea base de la Fase 0 ([`baseline-metrics.md`](../estrategia/fase-0-saneamiento-baseline/baseline-metrics.md)), las rutas HTTP de Next.js cortaban a 8s contra `cerebro-py` y a 15s contra un fallback legacy en `n8n`. La ingesta de PDFs técnicos, generación de itinerarios largos o baterías extensas de evaluación provocaba riesgo de timeouts `503` y bloqueaba el hilo de respuesta.
- **Decisión:** Desacoplar las tareas pesadas mediante **Amazon SQS + Dead-Letter Queue (DLQ)** y un worker Python en **AWS Lambda** declarado en Terraform ([`infra/main.tf`](../../infra/main.tf)), devolviendo `202 Accepted` con `job_id` desde Next.js y persistiendo el estado en PostgreSQL (`public.async_jobs`).
- **Alternativas descartadas:**
  - *Aumentar timeouts en Next.js / Serverless:* inviable en funciones serverless estándar y mala UX con la pestaña bloqueada.
  - *Mantener flujos no-code en `n8n`:* lógica opaca fuera de Git, difícil de testear en CI y sin tipado estricto.
- **Trade-offs asumidos:**
  - Mayor complejidad de estado en UI y backend: requiere tabla `async_jobs` con migraciones ([`20261124_async_jobs.sql`](../../supabase/migrations/20261124_async_jobs.sql)), endpoints de consulta (`/api/jobs/[id]`), polling/Realtime y gestión de reintentos/DLQ (`visibility_timeout_seconds = 360`, retención DLQ de 14 días).
- **Evidencia en el repo:** [`infra/main.tf`](../../infra/main.tf), [`src/app/api/jobs/`](../../src/app/api/jobs/route.ts), [`src/lib/aws/jobContracts.ts`](../../src/lib/aws/jobContracts.ts), [`cerebro-py/services/job_repository.py`](../../cerebro-py/services/job_repository.py).

---

## ADR-002 — Arquitectura híbrida (Next.js + Supabase + AWS) frente a 100% AWS o 100% Supabase

- **Contexto:** El producto necesita autenticación SSR, permisos granulares por fila, notificaciones en tiempo real (trigger SQL tras 3 fallos consecutivos del alumno) y, al mismo tiempo, procesamiento científico en Python (`PyMuPDF`, `Pydantic`) e infraestructura reproducible.
- **Decisión:** Adoptar una arquitectura híbrida: **Supabase** para Auth SSR (`@supabase/ssr`), PostgreSQL con Row Level Security (RLS) y Realtime; **Next.js 16 (App Router)** como frontend y BFF; y **AWS (S3, SQS, Lambda, ECR)** gestionado con Terraform para cargas pesadas.
- **Alternativas descartadas:**
  - *100% AWS (Cognito + RDS + API Gateway):* multiplicaba el tiempo de configuración de Auth/Realtime y el coste base fijo de RDS.
  - *100% Supabase (Edge Functions Deno):* limitada para el ecosistema Python de extracción PDF/ML y sin colas DLQ nativas equivalentes a SQS.
- **Trade-offs asumidos:**
  - Gestión de dos planos de credenciales e IAM (Supabase `service_role` vs. políticas IAM de mínimo privilegio en [`infra/iam.tf`](../../infra/iam.tf)), latencia de red entre Lambda y Supabase, y necesidad de mantener migraciones sincronizadas ([`supabase/RLS_MATRIX.md`](../../supabase/RLS_MATRIX.md)).
- **Evidencia en el repo:** [`src/lib/supabase/`](../../src/lib/supabase/server.ts), [`supabase/migrations/`](../../supabase/migrations/2026112503_rls_policies.sql), [`infra/iam.tf`](../../infra/iam.tf).

---

## ADR-003 — Control de costes y resiliencia LLM: Redis + LLM Router con fallback + Langfuse

- **Contexto:** En la Fase 0, el sistema tenía **0%** de caché, **0%** de rate limiting y **0%** de trazabilidad de tokens/latencia en producción, con un coste estimado a ciegas (`chars / 4`).
- **Decisión:** Combinar:
  1. **Redis (Upstash)** para caché y rate limiting por usuario desde el BFF.
  2. **LLM Router** en Python ([`llm_router.py`](../../cerebro-py/services/llm_router.py)) con proveedor primario (**Gemini**) y fallback automático (**OpenAI**) sobre contratos Pydantic.
  3. **Observabilidad con Langfuse** ([`observability.py`](../../cerebro-py/services/observability.py)) para registrar latencia, tokens reales y coste estimado (`estimate_cost_usd`).
- **Alternativas descartadas:**
  - *Llamadas directas a un único proveedor LLM sin caché:* vulnerable a caídas de API externa, picos de gasto por consultas repetidas y abuso por usuario.
- **Trade-offs asumidos:**
  - Dependencia de servicios externos adicionales (Upstash/Langfuse), mitigada diseñando degradación elegante (`not_configured` en `/api/health`) cuando no hay credenciales en entornos locales o CI.
- **Evidencia en el repo:** [`src/lib/redis/client.ts`](../../src/lib/redis/client.ts), [`src/lib/redis/rateLimiter.ts`](../../src/lib/redis/rateLimiter.ts), [`cerebro-py/services/llm_router.py`](../../cerebro-py/services/llm_router.py), [`cerebro-py/services/observability.py`](../../cerebro-py/services/observability.py).

---

## ADR-004 — Guardrails deterministas + Contratos Zod/Pydantic + Evals frente a solo Prompt Engineering

- **Contexto:** En Ciencias de la Salud y Ciencias Exactas (dosificación clínica en `mg`/`µg`/`UI`, balances de `ATP`, constantes físicas), una alucinación numérica o inyección de prompt es inaceptable.
- **Decisión:** Aplicar defensa en profundidad: validación de entrada/salida con **Zod** (TypeScript) y **Pydantic v2** (Python), guardrails deterministas (`detect_prompt_injection`, `validate_numerical_integrity` en [`guardrails.py`](../../cerebro-py/services/guardrails.py)) y una suite automatizada de **28 Evals** ejecutada como gate bloqueante en CI.
- **Alternativas descartadas:**
  - *Confiar únicamente en instrucciones del system prompt (`ai_prompt.md`):* no es determinista ni verificable automáticamente en cada PR.
- **Trade-offs asumidos:**
  - Mayor fricción al evolucionar esquemas (requiere actualizar contratos Zod/Pydantic y casos en `eval_dataset.jsonl` cuando cambian los formatos de salida).
- **Evidencia en el repo:** [`src/lib/schemas/cerebro.ts`](../../src/lib/schemas/cerebro.ts), [`cerebro-py/services/guardrails.py`](../../cerebro-py/services/guardrails.py), [`cerebro-py/evals/eval_dataset.jsonl`](../../cerebro-py/evals/eval_dataset.jsonl), [`cerebro-py/evals/run_evals.py`](../../cerebro-py/evals/run_evals.py).

---

## ADR-005 — Amazon S3 con Presigned URLs frente a proxy de archivos por el backend

- **Contexto:** Los docentes suben PDFs técnicos pesados y los alumnos descargan material/informes. Hacer pasar los binarios por las rutas API de Next.js consume memoria, ancho de banda y agota el tiempo de ejecución serverless.
- **Decisión:** Generar **Presigned URLs** de expiración corta en `/api/storage/presign` tras validar autenticación, tipo MIME y tamaño, dejando que el cliente transfiera el archivo directamente contra el bucket privado S3 (con bloqueo total de acceso público y cifrado AES256).
- **Alternativas descartadas:**
  - *Proxy multipart a través de Next.js:* cuello de botella en memoria y límite de payload en despliegues serverless.
- **Trade-offs asumidos:**
  - Exige configurar reglas CORS estrictas en S3 (`aws_s3_bucket_cors_configuration` en `infra/main.tf`) y lifecycle rules para limpiar subidas huérfanas en `uploads/tmp/` tras 7 días.
- **Evidencia en el repo:** [`src/app/api/storage/presign/route.ts`](../../src/app/api/storage/presign/route.ts), [`src/lib/aws/clients.ts`](../../src/lib/aws/clients.ts), [`infra/main.tf`](../../infra/main.tf).

---

## ADR-006 — Qdrant (Vector DB dedicada + búsqueda híbrida) frente a `pgvector` en Supabase

- **Contexto:** En Fase 0, `vectorstore_supabase.py` operaba en memoria (`_memory_store`, 0% persistencia). Al migrar a almacenamiento vectorial persistente, la bibliografía científica combina consultas semánticas con términos exactos (unidades como `µg`, `mmol/L`, enzimas como `CYP3A4`).
- **Decisión:** Usar **Qdrant** mediante un repositorio desacoplado ([`vector_repository.py`](../../cerebro-py/services/vector_repository.py)) con **búsqueda híbrida (densa + dispersa)**, filtros por payload (`rama_cientifica`, `asignatura`, `unidad`, `pagina_inicio`) e idempotencia por **doble hash** (`content_hash` + `embed_hash` en [`hash_manager.py`](../../cerebro-py/services/hash_manager.py)).
- **Alternativas descartadas:**
  - *`pgvector` dentro de PostgreSQL (Supabase):* mezcla carga analítica/vectorial con el plano OLTP transaccional y requiere más trabajo manual para combinar búsqueda dispersa léxica exacta + densa.
- **Trade-offs asumidos:**
  - Introduce un componente de persistencia adicional fuera de PostgreSQL y obliga a garantizar sincronización idempotente cuando se re-procesan PDFs (resuelto con el doble hash para evitar re-embeddings duplicados).
- **Evidencia en el repo:** [`cerebro-py/services/vector_repository.py`](../../cerebro-py/services/vector_repository.py), [`cerebro-py/services/hash_manager.py`](../../cerebro-py/services/hash_manager.py).
