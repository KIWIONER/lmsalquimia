# Línea Base Cuantitativa (Baseline) — Fase 0

> **Fecha de captura:** `2026-11-24T16:38:14.712Z`
> **Muestra por escenario:** `n = 10` | **Timeout cliente:** `20000 ms`
> **Entorno medido:** Next.js (`http://127.0.0.1:3000`, activo: `true`) · `cerebro-py` (`http://127.0.0.1:8055`, activo: `true`)

---

## 1. Métricas de Latencia, Disponibilidad y Coste Estimado

| Escenario | n | Éxito 2xx | Timeout / 503 | p50 | p95 | p99 | Tokens aprox (in/out) | Coste est. / req | Último error |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `POST /api/cerebro (generate_quiz)` | 10 | 100.0% | 0.0% | 206 ms | 291 ms | 291 ms | ~44/1674 | $0.001773 | — |
| `POST /api/cerebro (chat multi-disciplina)` | 10 | 100.0% | 0.0% | 1548 ms | 1573 ms | 1573 ms | ~45/183 | $0.000208 | — |

> **Nota sobre coste estimado:** Calculado por aproximación `chars / 4` con tarifa orientativa ($0.35/1M input, $1.05/1M output) como línea base previa a la instrumentación exacta de tokens con **Langfuse** en la Fase 2.

---

## 2. Disciplinas Científicas Evaluadas en Chat Tutor

1. **Medicina / Nutrición Clínica:** Dosificación de vitamina D (`µg` / `UI`) y riesgo de hipercalcemia.
2. **Química / Bioquímica:** Balance neto de `ATP`/`NADH` por `mol` de glucosa en glucólisis aeróbica.
3. **Física Aplicada a Ciencias de la Salud:** Ley de Poiseuille y resistencia hemodinámica (`r^4`, `mmHg`).

---

## 3. Fotografía Base de Arquitectura (Antes de Fases 1–3)

- **Ejecución de tareas pesadas:** 100% síncrona vía HTTP (`route.ts` corta a 8s en `cerebro-py` y 15s en `n8n` legacy). Sin colas SQS ni workers AWS Lambda.
- **Capa vectorial (RAG):** `cerebro-py/services/vectorstore_supabase.py` opera únicamente en memoria (`_memory_store`), **0% persistencia en Vector DB**. Línea base previa a la adopción de **Qdrant (RAG Híbrido Denso + Disperso)** en Fases 1–2.
- **Caché y Rate Limiting:** **0%** (sin Redis). Toda consulta repetida dispara ejecución completa.
- **Observabilidad y Evals:** **0%** trazabilidad de prompts en Langfuse; **0%** suite automatizada de Evals multi-disciplina.
