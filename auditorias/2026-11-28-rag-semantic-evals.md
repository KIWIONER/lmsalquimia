# Evals Semánticos sobre el RAG — Control Alimentario (`UD4`–`UD6`)

- **Fecha:** 2026-11-28
- **Dataset Golden:** `cerebro-py/evals/rag_golden_dataset.json` (`10` casos reales: `8` positivos de `UD4`, `UD5`, `UD6` + `2` adversarios de alucinación numérica)
- **Evaluador:** `cerebro-py/evals/rag_evals.py` (contratos Pydantic v2 `RagEvalCase`, `RagEvalItem`, `RagEvalSummary` + guardrail numérico `validate_numerical_integrity`)
- **Comando reproducible:** `PYTHONPATH=cerebro-py python -m evals.rag_evals --mode deterministic`

---

## 1. Métricas Obtenidas (`--mode deterministic`)

| Métrica | Resultado | Umbral | Estado |
| :--- | :---: | :---: | :---: |
| **Casos aprobados** | **10 / 10 (100%)** | `100%` | **PASS** |
| **Context Recall (media)** | **1.00** | `>= 0.85` | **PASS** |
| **Numerical Grounding (media)** | **1.00** | `== 1.00` | **PASS** |
| **Faithfulness léxico-científica (media)** | **0.69** | `>= 0.55` | **PASS** |
| **Detección de alucinaciones adversarias** | **2 / 2 (1.00)** | `== 1.00` | **PASS** |

---

## 2. Cobertura de Casos Clínicos y Hallazgo de Guardrail

- **Casos positivos (`8/8`):** cubren temperaturas y tiempos de pasteurización HTST (`72 °C · 15 s`, `77–92 °C · 15–60 s`), reducción microbiana (`95–99%`), fecha de caducidad vs. duración mínima, exención de alcohol `>= 10%`, Principio 7 APPCC, estandarización de leche (`3,7%`, `1,5–1,8%`, `< 1%`), refrigeración (`0–4 °C`, `14–19 °C`) y congelación (`-40 °C`, `-18 °C`).
- **Casos adversarios (`2/2` bloqueados):** `rag-adv-01` (`72 °C` alterado a `140 °C`) y `rag-adv-02` (`3,7%` alterado a `12,5%`) detectados con `numerical_grounding = 0.0`.
- **Corrección real derivada del eval:** al validar `15% de grasa` en `test_rag_evals.py`, se detectó que `NUMERICAL_DOSAGE_PATTERN` en `cerebro-py/services/guardrails.py` tenía un `\b` tras `%` que impedía capturar porcentajes seguidos de espacio (`15% de`); corregido y verificado con **`45/45` tests en `pytest`**.

---

## 3. Modo Juez Semántico (`--mode llm_judge`)
- `rag_evals.py` incluye además `--mode llm_judge` (`temperature=0`, `format="json"` contra Ollama local) combinado con el guardrail numérico duro (`numerical_grounding == 0.0` fuerza `faithfulness = 0.0`), validado en `test_rag_evals.py` mediante verificación de `call_args`.
