# Fase 0 — Estrategia de Saneamiento Técnico, Línea Base (Baseline) y Quick Wins

> **Guía de Arquitectura · Alquimia LMS (Nivel Mid 45k€)**
> **Orden de ejecución recomendado:** 1º (Prerrequisito antes de escalar infraestructura)

---

## 1. Propósito

Eliminar la deuda técnica heredada de la migración Astro → Next.js y capturar una **línea base cuantitativa (baseline)** del sistema actual antes de introducir AWS, Redis u observabilidad avanzada.

Sin este paso, cualquier mejora futura carece de evidencia medible ("antes vs. después") y el repositorio proyecta incoherencias visibles (como un `README.md` de plantilla Astro o dependencias obsoletas en `package.json`) que restan credibilidad técnica desde el primer segundo de inspección.

---

## 2. Objetivo a Conseguir

1. **Repositorio higiénico y coherente:** 100% alineado con Next.js App Router + React 19 + TypeScript + `cerebro-py` (Python/FastAPI), sin restos de Astro ni scripts muertos.
2. **Baseline de métricas reales documentado:** Medición verificada del estado inicial en 3 ejes clave (latencia p95, coste estimado por alumno/sesión y tasa de error/timeout).
3. **Contrato mínimo de salud y logging:** Primer estándar de logs estructurados y verificación de build/tipos en local y CI.
4. **Visibilidad inmediata:** Un `README.md` provisional pero profesional que refleje la arquitectura real actual (a ampliar en la Fase 4).

---

## 3. Punto de Partida (Estado Actual Auditado)

| Elemento | Archivo actual | Situación detectada |
| :--- | :--- | :--- |
| Dependencias legacy | `package.json`, `astro.config.mjs` | Coexisten `astro`, `@astrojs/netlify`, `@astrojs/node`, `@astrojs/react` con `next@^16.2.12`. |
| Nombre del paquete | `package.json` (`"name": "dimensional-doppler"`) | Nombre autogenerado por plantilla de Astro. |
| Documentación raíz | `README.md` | Plantilla por defecto *"Astro Starter Kit: Minimal"*. |
| Tests manuales | `integration_test.js` | Script CommonJS comentado que apunta a `config.js` de n8n. |
| CI actual | `.github/workflows/deploy.yml` | Solo ejecuta `npm run build` (no corre `tsc --noEmit` ni `pytest`). |
| Métricas actuales | Inexistentes | No hay registro de latencia p95, timeouts en `/api/cerebro` ni coste estimado por consulta. |

---

## 4. Requisitos y Alcance (Qué vamos a hacer)

### R0.1 — Limpieza de deuda técnica legacy (Astro)
- Auditar imports para confirmar que ningún archivo en `src/` depende de `astro` o `@astrojs/*`.
- Eliminar `astro`, `@astrojs/netlify`, `@astrojs/node` y `@astrojs/react` de `package.json` y regenerar `package-lock.json`.
- Retirar `astro.config.mjs` y actualizar `"name"` en `package.json` a `"alquimia-lms"`.
- Revisar `integration_test.js` y `config.js`: archivar o eliminar si no aportan valor frente a los tests modernos.

### R0.2 — Captura de Línea Base (Baseline) de Rendimiento y Coste
- Crear un script reproducible de medición (`scripts/benchmark_baseline.mjs`) que ejecute un lote controlado de peticiones contra el sistema actual:
  - Generación de quiz vía `POST /api/cerebro` (`action: "generate_quiz"`).
  - Consultas de chat tutor vía `POST /api/cerebro` cubriendo el dominio científico ampliado (**Nutrición/Medicina clínica, Química/Bioquímica y Física**).
  - Procesamiento de un PDF técnico real vía `cerebro-py/api/pdf/structure`.
- Registrar en `docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md`:
  - **Latencia p50 / p95 / p99** por endpoint.
  - **Tasa de timeout / error 503** (actualmente `route.ts` corta a 8s en Python y 15s en `n8n` legacy).
  - **Estimación de tokens y coste medio** por sesión de estudio / generación de quiz.
  - **Estado base de la capa vectorial** (`vectorstore_supabase.py` en memoria antes de migrar a **Qdrant**).

### R0.3 — Estándar mínimo de calidad en CI y Deprecación Explícita de `n8n` (Quick Win)
- Añadir `npm run lint` (`tsc --noEmit`) y ejecución de `pytest` sobre `cerebro-py/tests/` dentro del workflow de GitHub Actions.
- Verificar que `.env.example` documenta todas las variables requeridas por Next.js y `cerebro-py`, marca explícitamente `n8n` como **DEPRECADO (transitorio hasta Fases 1–2)** y deja preparadas las variables de **Qdrant** sin exponer secretos reales.

### R0.4 — Actualización inicial del `README.md`
- Reemplazar la plantilla de Astro por una portada técnica v1 que refleje la identidad real de **Alquimia LMS** (plataforma EdTech de Medicina, Nutrición, Química, Bioquímica y Física), la arquitectura actual vs. objetivo (**Next.js 16 + Supabase + Qdrant + AWS + Redis + Langfuse**, con `n8n` deprecado), cómo levantar Next.js + `cerebro-py` en local y el enlace al roadmap arquitectónico (`docs/estrategia/`).

### R0.5 — Proceso Limpio y Reproducible de Arranque Local (DX Multiplataforma)
- Estandarizar el bootstrap y arranque del stack completo (`Next.js` + `cerebro-py`) mediante scripts reproducibles en `package.json` y `scripts/`, evitando depender de comandos manuales frágiles por shell o activaciones manuales de `.venv`:
  - `npm run setup:py` (`scripts/setup_python.mjs`): crea `cerebro-py/.venv` si no existe e instala `cerebro-py/requirements.txt` de forma idempotente en Windows, macOS y Linux.
  - `npm run dev:all` (`scripts/dev_local.mjs`): levanta en una sola terminal `cerebro-py` (`127.0.0.1:8155` usando `python -m uvicorn --host ... --port ... --reload main:app`) y `Next.js` (`localhost:3100`), detecta automáticamente `cerebro-py/.venv` (con fallback controlado y aviso si se usa Python global), busca puertos libres automáticamente si hay colisión en IPv4/IPv6, prefija logs (`[next]` / `[cerebro-py]`) y cierra limpiamente ambos árboles de procesos al pulsar `Ctrl+C`.
  - `npm run dev:py`: permite levantar únicamente `cerebro-py` bajo el mismo contrato estandarizado.

---

## 5. Plan de Evaluación y Criterios de Aceptación (Qué vamos a evaluar)

### Checklist de Verificación

| ID | Criterio de Evaluación | Método de Verificación | Estado Objetivo |
| :--- | :--- | :--- | :--- |
| **EV0.1** | Cero referencias a Astro en el proyecto | `rg "astro" package.json src/` sin resultados y eliminación de `astro.config.mjs` | 0 coincidencias |
| **EV0.2** | Build y TypeScript limpios | `npm run lint` (`tsc --noEmit`) y `npm run build` exit code `0` | 100% verde |
| **EV0.3** | Tests Python existentes pasando en CI | `pytest cerebro-py/tests/` ejecutado automáticamente en GitHub Actions | 100% verde |
| **EV0.4** | Baseline documentado con datos reales | Existencia de `docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md` con p50/p95, tasa de fallo y coste estimado | Tabla completa con fecha y muestra >= 10 ejecuciones |
| **EV0.5** | `README.md` refleja el proyecto real | Revisión manual: sin menciones a Astro, instrucciones de arranque verificadas en limpio | Aprobado |
| **EV0.6** | Arranque local reproducible en un comando | `npm run setup:py` + `npm run dev:all` levantan `http://localhost:3100` y `http://127.0.0.1:8155/health` (`200 OK`) y se detienen limpiamente | 100% verificado |

### Definition of Done (DoD)
La Fase 0 se considera completada cuando cualquier desarrollador puede clonar el repo, leer el `README.md`, ejecutar `npm ci && npm run setup:py && npm run dev:all` para levantar todo el entorno local sin fricción, validar `npm run lint && npm run build && pytest`, y consultar en un documento los números reales contra los que se compararán las Fases 1, 2 y 3.

---

## 6. Riesgos y Mitigaciones

- **Riesgo:** Algún componente antiguo aún importe utilidades de Astro o estilos acoplados.
  - *Mitigación:* Búsqueda global previa en `src/` y verificación completa con `npm run build` antes de borrar el lockfile.
- **Riesgo:** Medir el baseline con datos sintéticos poco representativos.
  - *Mitigación:* Usar al menos un PDF real de nutrición y 3 prompts reales del dominio ("Profesor Alquimia") para que la comparativa final sea defendible en entrevista.
