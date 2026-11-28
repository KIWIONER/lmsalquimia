# Benchmark End-to-End en Producción Cloud AWS (`eu-west-1`)

- **Fecha:** 2026-11-28
- **Script reproducible:** `node --env-file=.env.local scripts/benchmark_aws_e2e.mjs`
- **Flujo medido:** `Supabase async_jobs (pending)` ➔ `AWS SQS` ➔ `AWS Lambda (ECR Python 3.12 · 4 capas)` ➔ `AWS S3 (PDF input + JSON report)` ➔ `Supabase async_jobs (processing -> completed)`
- **Documento real de prueba:** `UD2.2-CONTROL-ALIMENTARIO.pdf` (Control Alimentario, `8` tarjetas)
- **Infraestructura:** `eu-west-1`, Lambda `1024 MB` / `timeout 120 s`, SQS `maximum_concurrency = 5`, presupuesto FinOps `$5 USD/mes`.

---

## 1. Resumen de Métricas Reales (`n = 5`)

| Métrica | Valor Medido | Notas |
| :--- | :---: | :--- |
| **Tasa de éxito** | **5 / 5 (100%)** | `0` errores, `0` mensajes a DLQ, `attempts = 1` en todos |
| **Persistencia incremental observada** | **5 / 5 (100%)** | Transición real `pending ➔ processing ➔ completed` |
| **Encolado SQS `p50`** | **132 ms** | Conexión TLS ya caliente (`126–137 ms`) |
| **Encolado SQS `p95`** | **644 ms** | Incluye primera negociación TLS (`Run 1`) |
| **E2E Lambda Cold Start (`Run 1`)** | **7.224 ms (7,22 s)** | Arranque de contenedor ECR + PyMuPDF + S3 + Supabase |
| **E2E Lambda Warm `p50` (`Runs 2–5`)** | **3.066 ms (3,07 s)** | Pipeline completo + reporte JSON en S3 |
| **E2E Lambda Warm `p95` (`Runs 2–5`)** | **3.149 ms (3,15 s)** | Desviación mínima (`3.025–3.149 ms`) |
| **E2E Lambda Warm Media (`Runs 2–5`)** | **3.080 ms (3,08 s)** | Consistencia estable bajo ejecución secuencial |

---

## 2. Detalle por Ejecución

| Run | Estado | Enqueue SQS | Latencia E2E Total | Tarjetas | Reporte S3 | Estados Observados |
| :-: | :---: | :---: | :---: | :-: | :---: | :--- |
| 1 (Cold) | `completed` | `644 ms` | `7.224 ms` | `8` | `true` | `pending ➔ processing ➔ completed` |
| 2 (Warm) | `completed` | `137 ms` | `3.149 ms` | `8` | `true` | `pending ➔ processing ➔ completed` |
| 3 (Warm) | `completed` | `129 ms` | `3.025 ms` | `8` | `true` | `pending ➔ processing ➔ completed` |
| 4 (Warm) | `completed` | `126 ms` | `3.079 ms` | `8` | `true` | `pending ➔ processing ➔ completed` |
| 5 (Warm) | `completed` | `132 ms` | `3.066 ms` | `8` | `true` | `pending ➔ processing ➔ completed` |

---

## 3. Hallazgo de Right-Sizing FinOps (CloudWatch)
- **Configuración inicial (`512 MB` / `60 s`):** CloudWatch reportó `Max Memory Used: 496 MB / 512 MB` y `Status: timeout` en `60.000 ms` debido a la presión de memoria y vCPU fraccionada al inicializar `pymupdf4llm` + `onnxruntime`.
- **Ajuste aplicado en Terraform (`infra/main.tf`) y AWS Lambda (`1024 MB` / `120 s`):** al duplicar memoria y vCPU proporcional, el procesamiento bajó de timeout (`> 60 s`) a **`3,07 s` (`p50` warm)**, reduciendo drásticamente los GB-segundos facturados por ejecución.
