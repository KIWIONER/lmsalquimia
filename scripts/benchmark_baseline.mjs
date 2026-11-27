/**
 * Alquimia LMS — Benchmark de Línea Base (Fase 0)
 *
 * Mide latencia (p50, p95, p99, media), tasa de éxito vs. timeouts/503
 * y estimación de tokens/coste antes de introducir AWS SQS/Lambda, Redis,
 * Qdrant y Langfuse.
 *
 * Uso:
 *   node scripts/benchmark_baseline.mjs
 *
 * Variables de entorno opcionales:
 *   TARGET_NEXT_URL=http://127.0.0.1:3100
 *   TARGET_CEREBRO_URL=http://127.0.0.1:8155
 *   BENCHMARK_RUNS=10
 *   BENCHMARK_TIMEOUT_MS=20000
 *   BENCHMARK_PDF_URL=https://... (opcional para medir /api/pdf/structure)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

const TARGET_NEXT_URL = process.env.TARGET_NEXT_URL || "http://127.0.0.1:3100";
const TARGET_CEREBRO_URL = process.env.TARGET_CEREBRO_URL || "http://127.0.0.1:8155";
const RUNS = Math.max(1, Number.parseInt(process.env.BENCHMARK_RUNS || "10", 10));
const TIMEOUT_MS = Number.parseInt(process.env.BENCHMARK_TIMEOUT_MS || "20000", 10);
const BENCHMARK_PDF_URL = process.env.BENCHMARK_PDF_URL || "";

// Tarifa orientativa de referencia (USD por 1M tokens: input $0.35 / output $1.05)
const INPUT_COST_PER_1M = 0.35;
const OUTPUT_COST_PER_1M = 1.05;

const SCIENTIFIC_PROMPTS = [
  {
    discipline: "Medicina / Nutrición Clínica",
    query:
      "Explica la ingesta diaria recomendada de vitamina D en adultos (en µg y UI) y el riesgo de toxicidad por hipercalcemia.",
  },
  {
    discipline: "Química / Bioquímica",
    query:
      "Resume el balance neto de ATP y NADH por mol de glucosa en la glucólisis aeróbica y cita las enzimas reguladoras clave.",
  },
  {
    discipline: "Física Aplicada a Ciencias de la Salud",
    query:
      "Explica la ley de Poiseuille aplicada al flujo sanguíneo y cómo influye el radio vascular (r^4) en la resistencia hemodinámica (mmHg).",
  },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

async function timedPost(url, payload) {
  const inputStr = JSON.stringify(payload);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: inputStr,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    const durationMs = performance.now() - t0;
    return {
      ok: res.ok,
      status: res.status,
      durationMs,
      timeout: res.status === 503 || res.status === 504,
      inputTokens: estimateTokens(inputStr),
      outputTokens: estimateTokens(text),
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    const durationMs = performance.now() - t0;
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      durationMs,
      timeout: isTimeout,
      inputTokens: estimateTokens(inputStr),
      outputTokens: 0,
      error: err?.message || "Network error",
    };
  }
}

function summarize(name, results) {
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const okCount = results.filter((r) => r.ok).length;
  const timeoutCount = results.filter((r) => r.timeout).length;
  const avgMs = durations.reduce((acc, v) => acc + v, 0) / (durations.length || 1);
  const totalIn = results.reduce((acc, r) => acc + r.inputTokens, 0);
  const totalOut = results.reduce((acc, r) => acc + r.outputTokens, 0);
  const avgCostUsd =
    ((totalIn / 1_000_000) * INPUT_COST_PER_1M + (totalOut / 1_000_000) * OUTPUT_COST_PER_1M) /
    (results.length || 1);

  return {
    name,
    n: results.length,
    okRate: ((okCount / results.length) * 100).toFixed(1),
    timeoutRate: ((timeoutCount / results.length) * 100).toFixed(1),
    p50: Math.round(percentile(durations, 50)),
    p95: Math.round(percentile(durations, 95)),
    p99: Math.round(percentile(durations, 99)),
    avg: Math.round(avgMs),
    avgInTokens: Math.round(totalIn / (results.length || 1)),
    avgOutTokens: Math.round(totalOut / (results.length || 1)),
    avgCostUsd: avgCostUsd.toFixed(6),
    lastError: results.find((r) => r.error)?.error || "—",
  };
}

async function checkService(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return { up: res.ok, status: res.status };
  } catch (err) {
    return { up: false, status: 0, error: err?.message || "Unreachable" };
  }
}

async function main() {
  console.log(`\n=== Alquimia LMS — Benchmark Baseline (n=${RUNS}) ===`);
  console.log(`Next.js:    ${TARGET_NEXT_URL}`);
  console.log(`cerebro-py: ${TARGET_CEREBRO_URL}\n`);

  const nextStatus = await checkService(`${TARGET_NEXT_URL}/`);
  const pyStatus = await checkService(`${TARGET_CEREBRO_URL}/health`);

  const summaries = [];

  // 1. Quiz adaptativo vía POST /api/cerebro
  console.log(`[1/3] Midiendo generación de quiz (${RUNS} ejecuciones)...`);
  const quizResults = [];
  for (let i = 0; i < RUNS; i++) {
    quizResults.push(
      await timedPost(`${TARGET_NEXT_URL}/api/cerebro`, {
        action: "generate_quiz",
        topics: ["Macronutrientes", "Metabolismo Energético"],
        difficulty: 5,
        numQuestions: 5,
        mode: "practice",
        sessionId: `baseline-quiz-${Date.now()}-${i}`,
      })
    );
  }
  summaries.push(summarize("POST /api/cerebro (generate_quiz)", quizResults));

  // 2. Chat tutor multi-disciplina (Medicina/Nutrición, Química/Bioquímica, Física)
  console.log(`[2/3] Midiendo chat tutor multi-disciplina (${RUNS} ejecuciones)...`);
  const chatResults = [];
  for (let i = 0; i < RUNS; i++) {
    const prompt = SCIENTIFIC_PROMPTS[i % SCIENTIFIC_PROMPTS.length];
    chatResults.push(
      await timedPost(`${TARGET_NEXT_URL}/api/cerebro`, {
        query: prompt.query,
        sessionId: `baseline-chat-${Date.now()}-${i}`,
      })
    );
  }
  summaries.push(summarize("POST /api/cerebro (chat multi-disciplina)", chatResults));

  // 3. Extracción PDF en cerebro-py (opcional si BENCHMARK_PDF_URL está definida)
  if (BENCHMARK_PDF_URL) {
    console.log(`[3/3] Midiendo extracción PDF en cerebro-py (${RUNS} ejecuciones)...`);
    const pdfResults = [];
    for (let i = 0; i < RUNS; i++) {
      pdfResults.push(
        await timedPost(`${TARGET_CEREBRO_URL}/api/pdf/structure`, {
          pdf_url: BENCHMARK_PDF_URL,
        })
      );
    }
    summaries.push(summarize("POST cerebro-py /api/pdf/structure", pdfResults));
  } else {
    console.log(`[3/3] Extracción PDF omitida (define BENCHMARK_PDF_URL para incluirla).`);
  }

  const nowIso = new Date().toISOString();
  const rows = summaries
    .map(
      (s) =>
        `| \`${s.name}\` | ${s.n} | ${s.okRate}% | ${s.timeoutRate}% | ${s.p50} ms | ${s.p95} ms | ${s.p99} ms | ~${s.avgInTokens}/${s.avgOutTokens} | \$${s.avgCostUsd} | ${s.lastError} |`
    )
    .join("\n");

  const markdown = `# Línea Base Cuantitativa (Baseline) — Fase 0

> **Fecha de captura:** \`${nowIso}\`
> **Muestra por escenario:** \`n = ${RUNS}\` | **Timeout cliente:** \`${TIMEOUT_MS} ms\`
> **Entorno medido:** Next.js (\`${TARGET_NEXT_URL}\`, activo: \`${nextStatus.up}\`) · \`cerebro-py\` (\`${TARGET_CEREBRO_URL}\`, activo: \`${pyStatus.up}\`)

---

## 1. Métricas de Latencia, Disponibilidad y Coste Estimado

| Escenario | n | Éxito 2xx | Timeout / 503 | p50 | p95 | p99 | Tokens aprox (in/out) | Coste est. / req | Último error |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${rows}

> **Nota sobre coste estimado:** Calculado por aproximación \`chars / 4\` con tarifa orientativa (\$${INPUT_COST_PER_1M}/1M input, \$${OUTPUT_COST_PER_1M}/1M output) como línea base previa a la instrumentación exacta de tokens con **Langfuse** en la Fase 2.

---

## 2. Disciplinas Científicas Evaluadas en Chat Tutor

1. **Medicina / Nutrición Clínica:** Dosificación de vitamina D (\`µg\` / \`UI\`) y riesgo de hipercalcemia.
2. **Química / Bioquímica:** Balance neto de \`ATP\`/\`NADH\` por \`mol\` de glucosa en glucólisis aeróbica.
3. **Física Aplicada a Ciencias de la Salud:** Ley de Poiseuille y resistencia hemodinámica (\`r^4\`, \`mmHg\`).

---

## 3. Fotografía Base de Arquitectura (Antes de Fases 1–3)

- **Ejecución de tareas pesadas:** 100% síncrona vía HTTP (\`route.ts\` corta a 8s en \`cerebro-py\` y 15s en \`n8n\` legacy). Sin colas SQS ni workers AWS Lambda.
- **Capa vectorial (RAG):** \`cerebro-py/services/vectorstore_supabase.py\` opera únicamente en memoria (\`_memory_store\`), **0% persistencia en Vector DB**. Línea base previa a la adopción de **Qdrant (RAG Híbrido Denso + Disperso)** en Fases 1–2.
- **Caché y Rate Limiting:** **0%** (sin Redis). Toda consulta repetida dispara ejecución completa.
- **Observabilidad y Evals:** **0%** trazabilidad de prompts en Langfuse; **0%** suite automatizada de Evals multi-disciplina.
`;

  const outPath = resolve("docs/estrategia/fase-0-saneamiento-baseline/baseline-metrics.md");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, markdown, "utf-8");

  console.log("\nResumen:");
  console.table(
    summaries.map((s) => ({
      Escenario: s.name,
      "2xx%": s.okRate,
      "Timeout%": s.timeoutRate,
      "p50(ms)": s.p50,
      "p95(ms)": s.p95,
      "Coste($)": s.avgCostUsd,
    }))
  );
  console.log(`\nReporte guardado en: ${outPath}\n`);
}

main();
