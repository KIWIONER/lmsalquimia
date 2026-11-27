# Fase 4 — Estrategia de Presentación de Ingeniería, Trade-offs y Métricas (CTO-Ready)

> **Guía de Arquitectura · Alquimia LMS (Nivel Mid 45k€)**
> **Objetivo estratégico:** Convertir todo el trabajo técnico de las Fases 0–3 en un escaparate de ingeniería claro, verificable y defendible ante un CTO o Engineering Manager en menos de 3 minutos de lectura.

---

## 1. Propósito

En procesos de selección técnica (45k€+), el código por sí solo rara vez se lee línea por línea al inicio: el filtro ocurre en los primeros **2–3 minutos** al abrir el repositorio en GitHub.

El propósito de esta fase es construir la narrativa técnica definitiva del proyecto: no una lista genérica de tecnologías, sino **evidencia de criterio arquitectónico** (por qué se eligió cada pieza, qué se sacrificó y qué mejora cuantitativa produjo).

---

## 2. Objetivo a Conseguir

1. **`README.md` de nivel ingeniería de producción:** Claro, escaneable, con badges de CI reales, diagrama de arquitectura completo y guía de arranque en local y cloud.
2. **Registro de Decisiones Técnicas y Trade-offs (ADRs):** Documentación honesta de las decisiones clave de arquitectura y sus alternativas descartadas.
3. **Evidencia empírica *Antes vs. Después*:** Tabla comparativa con métricas reales tomadas en la Fase 0 frente a las obtenidas tras completar las Fases 1–3.
4. **Material de demostración rápida:** Capturas/GIFs de la UI, trazas de Langfuse, ejecución de Terraform/SQS y resultados de Evals.

---

## 3. Punto de Partida (Estado Actual Auditado)

- `README.md` actual es una plantilla vacía de Astro.
- `CONTEXT.md` contiene información técnica valiosa, pero está redactado como manual interno para agentes IA y no incluye trade-offs, costes reales, arquitectura AWS ni métricas de rendimiento.

---

## 4. Requisitos y Alcance (Qué vamos a hacer)

### R4.1 — `README.md` Técnico Definitivo
Estructurar el `README.md` raíz con las siguientes secciones obligatorias:
1. **Cabecera ejecutiva + Badges en vivo:** Estado del workflow CI (GitHub Actions), cobertura/tests, stack principal y enlace a demo desplegada.
2. **Problema que resuelve y dominio:** Plataforma EdTech de Nutrición y Dietética con tutoría IA basada en evidencia y micro-learning adaptativo.
3. **Diagrama de Arquitectura Completo (Mermaid):** Flujo unificado `Next.js App Router ↔ Supabase (Auth/RLS/Realtime) ↔ Redis (Upstash) ↔ AWS (S3 Presigned / SQS + DLQ / Lambda Python) ↔ Qdrant (RAG Híbrido) ↔ LLM Router (Fallback) ↔ Langfuse`.
4. **Métricas Reales (*Antes vs. Después*):**
   - Latencia HTTP percibida por el usuario en tareas pesadas (p95).
   - Tasa de timeouts/errores `503`.
   - Reducción de coste de tokens gracias a caché Redis (% cache hit).
   - Score de la suite de 25–30 Evals y 0 alucinaciones en dosis clínicas (`guardrails.py`).
   - Coste mensual real de infraestructura AWS.
5. **Quickstart Reproducible:** Pasos exactos para levantar frontend, `cerebro-py`, migraciones Supabase, tests (`vitest`, `pytest`, `playwright`) y `terraform plan`.

### R4.2 — Sección de Decisiones Técnicas y Trade-offs (`docs/architecture/decisions.md` + resumen en README)
Documentar en formato **ADR ligero (Contexto → Decisión → Alternativas descartadas → Trade-offs)** al menos 5 decisiones críticas:
1. **Por qué AWS SQS + Lambda (asíncrono) frente a Next.js API Routes / Serverless síncrono:** eliminación de timeouts de 10–15s, absorción de picos y DLQ vs. mayor complejidad de estado en UI (polling/Realtime).
2. **Por qué arquitectura híbrida (Supabase + AWS) frente a 100% AWS o 100% Supabase:** velocidad de Auth/RLS/Realtime en Supabase combinada con potencia de cómputo Python + IaC estándar en AWS.
3. **Estrategia de control de costes de tokens:** Redis (caché + rate limit por usuario) + enrutamiento de modelos + trazabilidad en Langfuse.
4. **Guardrails deterministas + Evals automáticos:** por qué combinar regex de dosis clínicas (`guardrails.py`) + Pydantic/Zod + LLM-as-a-Judge en lugar de confiar solo en prompt engineering.
5. **S3 con Presigned URLs frente a proxy de archivos por el backend:** descarga de ancho de banda/memoria en Next.js y seguridad por expiración corta.
6. **Qdrant (Vector DB dedicada + búsqueda híbrida) frente a `pgvector` en Supabase:** separación de cargas analíticas/vectoriales respecto a OLTP, búsqueda híbrida densa + dispersa nativa para terminología científica/médica y filtrado ultrarrápido por payload (`rama`, `asignatura`, `página`), asumiendo el trade-off de sincronización idempotente por doble hash.

### R4.3 — Evidencias Visuales y Recorrido de Demo
- Incluir en `docs/assets/` (y enlazar en el README) 3–4 capturas reales verificables:
  - Dashboard/lección y quiz adaptativo de Alquimia LMS.
  - Panel de trazas de **Langfuse** mostrando latencia, tokens y coste.
  - Consola/output de **suite de Evals** y **GitHub Actions** en verde.
  - Output de `terraform plan` / arquitectura AWS desplegada.

---

## 5. Plan de Evaluación y Criterios de Aceptación (Qué vamos a evaluar)

### Checklist de Verificación

| ID | Criterio de Evaluación | Método de Verificación | Estado Objetivo |
| :--- | :--- | :--- | :--- |
| **EV4.1** | Test de lectura rápida (3 minutos) | Un revisor técnico externo entiende arquitectura, flujos y valor sin abrir `src/` | Comprensión total en < 3 min |
| **EV4.2** | Coherencia 100% con el código real | Cada caja del diagrama Mermaid y cada comando del README existe y funciona en el repo | 0 "vaporware" o comandos rotos |
| **EV4.3** | Métricas trazables y honestas | Todos los números *Antes vs. Después* provienen de `baseline-metrics.md`, Langfuse o reportes reales de CI | 100% datos reales medidos |
| **EV4.4** | Trade-offs con criterio senior/mid | Cada ADR explica explícitamente **qué se pierde o complica** con la decisión elegida (no solo ventajas) | >= 5 ADRs documentados |
| **EV4.5** | Limpieza documental del repositorio | Enlaces internos verificados, `CONTEXT.md` sincronizado con la nueva arquitectura y sin docs obsoletos | 0 enlaces rotos |

### Definition of Done (DoD)
La Fase 4 está completa cuando el `README.md` y los ADRs están publicados en `main`, todos los enlaces, badges y capturas renderizan correctamente en GitHub, y las métricas comparativas reflejan datos reales reproducibles del proyecto.

---

## 6. Riesgos y Mitigaciones

- **Riesgo:** Caer en "marketing vacío" listando herramientas sin explicar por qué están ahí.
  - *Mitigación:* Aplicar la regla de que cada tecnología mencionada en el README debe responder a un problema medido en la Fase 0 y mostrar su trade-off en los ADRs.
- **Riesgo:** Documentación desactualizada respecto al código si cambian detalles en Fases 1–3.
  - *Mitigación:* Ejecutar la Fase 4 estrictamente al cierre (actualizando el README de forma incremental solo cuando cada hito ya esté verificado y mergeado).
