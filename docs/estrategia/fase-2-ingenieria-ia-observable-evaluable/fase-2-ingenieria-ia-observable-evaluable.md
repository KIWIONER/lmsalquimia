# Fase 2 — Estrategia de Ingeniería de IA Observable y Evaluable

> **Guía de Arquitectura · Alquimia LMS (Nivel Mid 45k€)**
> **Objetivo estratégico:** Pasar de "llamar a un LLM" a operar una capa de IA con contratos estrictos, protección de costes, trazabilidad en producción y evaluación automatizada de calidad pedagógica.

---

## 1. Propósito

En sistemas EdTech con IA (especialmente en dominio clínico/nutricional), un LLM sin contratos, sin caché ni evaluación sistemática representa tres riesgos críticos:
1. **Riesgo funcional:** JSON malformado que rompe el motor de quizzes o itinerarios.
2. **Riesgo financiero:** Un usuario o bucle de reintentos puede disparar la factura de tokens sin control.
3. **Riesgo pedagógico/clínico:** Cambiar un prompt puede introducir alucinaciones o alterar dosis nutricionales sin que nadie lo detecte hasta que llega al alumno.

Esta fase implementa el estándar real de un **AI Engineer Mid**.

---

## 2. Objetivo a Conseguir

1. **Contratos estrictos + Fallback multi-LLM:** Toda entrada/salida de IA validada con Zod (Next.js) y Pydantic (Python), con degradación automática a un proveedor secundario si el principal falla o supera timeout.
2. **Control de costes y abuso con Redis:** Caché semántica/exacta para respuestas recurrentes y *rate limiting* por usuario.
3. **Observabilidad completa de IA:** Trazas de cada llamada LLM en Langfuse (o OpenTelemetry) midiendo latencia p95, tokens, coste por alumno y tasa de error por versión de prompt.
4. **Suite automatizada de Evals (25–30 casos):** Gate de calidad reproducible que valida formato, rigor pedagógico y seguridad numérica clínica (integrando `guardrails.py`) antes de desplegar cambios de prompts.

---

## 3. Punto de Partida (Estado Actual Auditado)

- **A favor:**
  - `cerebro-py/schemas/quiz.py` y `cerebro-py/schemas/dataset.py` ya usan **Pydantic v2**.
  - `cerebro-py/services/guardrails.py` ya implementa validación regex de integridad de dosis numéricas clínicas (`mg`, `µg`, `kcal`, etc.) frente al texto fuente — un activo diferencial excelente.
- **Brechas actuales:**
  - Next.js no usa **Zod** en sus API routes (`src/app/api/**`).
  - El fallback actual en `src/app/api/cerebro/route.ts` es solo de transporte (`cerebro-py` → `n8n`), no de proveedor LLM con política de reintento/circuit breaker.
  - No existe Redis (ni caché ni rate limiting).
  - No existe Langfuse/OpenTelemetry ni métricas de coste/latencia por prompt.
  - No existe suite de Evals de prompts (solo tests unitarios de utilidades en `cerebro-py/tests/`).

---

## 4. Requisitos y Alcance (Qué vamos a hacer)

### R2.1 — Contratos Estrictos (Zod + Pydantic) y Fallback Multi-Proveedor
- **Next.js (`src/lib/schemas/`):** Añadir `zod` y validar estrictamente payloads de entrada y respuestas de `/api/cerebro` y generación de itinerarios/quizzes.
- **Python (`cerebro-py/services/llm_router.py`):** Centralizar las llamadas LLM en un enrutador con:
  - Proveedor primario (ej. Gemini) + proveedor secundario de fallback (ej. OpenAI / Anthropic / Groq) activado automáticamente ante HTTP `429`, `5xx`, timeout o fallo de validación Pydantic tras 1 reintento de reparación.
  - Registro explícito en metadatos de qué proveedor y modelo respondió (`provider`, `model`, `fallback_used`).

### R2.2 — Caché y Rate Limiting en Redis (Upstash)
- Integrar Redis serverless (Upstash Free Tier) en Next.js y/o `cerebro-py`:
  - **Rate Limiting:** Ventana deslizante por `user_id` (ej. 30 mensajes de chat/hora y 10 generaciones de quiz/hora) devolviendo `429 Too Many Requests` con header `Retry-After`.
  - **Caché de respuestas recurrentes:** Clave normalizada por hash `(action + topic_ids + difficulty + prompt_version)` con TTL configurable (ej. 24h para explicaciones de conceptos base e itinerarios estándar). Registrar `cache_hit: true/false`.

### R2.3 — Trazabilidad y Observabilidad con Langfuse (u OpenTelemetry)
- Instrumentar todas las llamadas LLM con SDK de **Langfuse** (plan Hobby gratuito) o exportación OpenTelemetry:
  - Etiquetar cada traza con: `user_id`, `session_id`, `feature` (`tutor_chat` | `quiz_gen` | `itinerary`), `prompt_version`, `provider`, `cache_hit`.
  - Registrar automáticamente: latencia (ms), `input_tokens`, `output_tokens`, coste USD/EUR calculado y resultado de validación (`schema_valid`, `guardrail_passed`).
- Configurar vista/dashboard con los 3 KPIs exigidos: **latencia p95**, **coste medio por alumno** y **tasa de error por versión de prompt**.

### R2.4 — Suite de Evals Automatizados (25–30 Casos)
- Crear directorio `cerebro-py/evals/` con un dataset versionado (`eval_dataset.jsonl`) de **25 a 30 casos reales de Nutrición y Dietética**, cubriendo:
  - **10 casos de formato y contrato:** estructura exacta de quizzes, itinerarios y etiquetas `[[REFS:...]]`.
  - **10 casos de calidad pedagógica (LLM-as-a-Judge):** claridad, adecuación al nivel solicitado (1–10) y tono del Profesor Alquimia (`ai_prompt.md`).
  - **8–10 casos adversariales y de alucinación clínica:** dosis numéricas fuera de fuente (evaluados deterministamente con `guardrails.py`), preguntas fuera de dominio y *prompt injection* básico.
- Crear runner `python -m evals.run_evals` que genere un reporte JSON/Markdown con puntuación global y falle el proceso (`exit 1`) si baja del umbral definido.

### R2.5 — Base de Datos Vectorial Dedicada y RAG Híbrido con Qdrant
- Evolucionar el repositorio vectorial de `cerebro-py` hacia una interfaz desacoplada (`VectorRepository`) con implementación real sobre **Qdrant** (Qdrant Cloud Free Tier 1 GB en producción / Docker en local).
- Configurar colecciones científicas con **búsqueda híbrida (vectores densos + dispersos BM25/SPLADE)** para capturar tanto el sentido semántico como términos exactos críticos en Medicina, Nutrición, Química y Física (fórmulas, enzimas, unidades y dosificaciones).
- Indexar metadatos estructurados (*payload indexes*) para filtrado ultrarrápido por `rama_cientifica`, `asignatura`, `documento_origen`, `unidad` y `pagina_inicio/fin`.
- Conservar y conectar la estrategia de **doble hash (`content_hash` + `embed_hash`)** ya existente en `cerebro-py/services/hash_manager.py` para evitar recomputar embeddings cuando solo cambian metadatos o contenido sin impacto semántico.
- Incluir métricas de calidad de retrieval (`Recall@K` / relevancia de chunks recuperados) dentro de las trazas de Langfuse y la suite de Evals.

---

## 5. Plan de Evaluación y Criterios de Aceptación (Qué vamos a evaluar)

### Checklist de Verificación

| ID | Criterio de Evaluación | Método de Verificación | Estado Objetivo |
| :--- | :--- | :--- | :--- |
| **EV2.1** | Validación estricta Zod/Pydantic | Enviar payloads inválidos a API Next.js y salidas corruptas simuladas del LLM | `400` limpio en entrada; reparación/fallback sin crash en salida |
| **EV2.2** | Fallback multi-LLM operativo | Simular caída (`503`/timeout) del proveedor primario en test automatizado | Respuesta servida por secundario con `fallback_used: true` |
| **EV2.3** | Rate limiting y caché Redis | Ejecutar ráfaga > límite con mismo `user_id`; repetir consulta idéntica | `429` en exceso; 2ª consulta idéntica con `cache_hit: true` y latencia < 100ms |
| **EV2.4** | Trazas reales en Langfuse | Ejecutar 10 flujos variados y auditar panel de trazas | 100% de llamadas con latencia, tokens, coste y `prompt_version` |
| **EV2.5** | Suite de Evals (25–30 casos) | Ejecutar `run_evals` sobre la versión actual de `ai_prompt.md` | >= 25 casos; 100% pass en contratos y guardrails clínicos; >= 85% score pedagógico |
| **EV2.6** | RAG Híbrido e Idempotencia en Qdrant | Re-ingestar un mismo PDF y consultar términos científicos exactos + filtro por rama/asignatura | 0 chunks duplicados (doble hash); retrieval híbrido con `Recall@5 >= 85%` |

### Definition of Done (DoD)
La Fase 2 está completa cuando cada llamada de IA pasa por contrato estricto + caché/rate-limit Redis + trazabilidad en Langfuse, existe fallback probado entre proveedores y los cambios de prompts se validan contra la suite de 25–30 Evals antes de llegar a `main`.

---

## 6. Riesgos y Mitigaciones

- **Riesgo:** Coste de ejecutar Evals con LLM-as-a-Judge en cada commit de CI.
  - *Mitigación:* Ejecutar los evals deterministas (contratos + `guardrails.py`) en cada PR, y la suite completa con juez LLM solo cuando cambien archivos de prompts/servicios IA o mediante `workflow_dispatch`.
- **Riesgo:** Cachear respuestas que deberían ser personalizadas para el alumno.
  - *Mitigación:* Aplicar caché solo a consultas de conocimiento base o generaciones parametrizadas por temario/dificultad, nunca al historial conversacional privado del alumno.
