/**
 * Benchmark End-to-End real sobre AWS Cloud (eu-west-1):
 * Supabase async_jobs (pending) -> AWS SQS -> AWS Lambda (ECR 4-Capas)
 * -> AWS S3 (PDF input + JSON report) -> Supabase async_jobs (processing -> completed)
 *
 * Uso: node --env-file=.env.local scripts/benchmark_aws_e2e.mjs
 */

import { randomUUID } from "node:crypto";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createClient } from "@supabase/supabase-js";

const SAMPLE_S3_KEY =
  process.env.BENCHMARK_S3_KEY ||
  "uploads/pdfs/biblioteca/dietetica-nutricion/control-alimentario/UD7-I.__Alteraciones_de_los_alimentos.pdf";
const RUNS = Number(process.env.BENCHMARK_RUNS || 5);
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 90_000;

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function main() {
  const region = process.env.AWS_REGION || "eu-west-1";
  const queueUrl = process.env.AWS_SQS_QUEUE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!queueUrl || !supabaseUrl || !serviceKey) {
    throw new Error("Faltan AWS_SQS_QUEUE_URL, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  }

  const sqs = new SQSClient({ region });
  const sb = createClient(supabaseUrl, serviceKey);

  const { data: usersData, error: uErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (uErr || !usersData?.users?.length) {
    throw new Error("No se encontró usuario en auth.users para asociar async_jobs");
  }
  const userId = usersData.users[0].id;

  console.log(`=== Benchmark AWS Cloud E2E (SQS -> Lambda ECR -> S3 -> Supabase) ===`);
  console.log(`Region: ${region} | Runs: ${RUNS} | PDF: ${SAMPLE_S3_KEY}`);

  const runs = [];
  for (let i = 1; i <= RUNS; i++) {
    const jobId = randomUUID();
    const correlationId = randomUUID();
    const createdAt = new Date().toISOString();
    const t0 = performance.now();

    const { error: insErr } = await sb.from("async_jobs").insert([
      {
        id: jobId,
        user_id: userId,
        type: "pdf_structure",
        status: "pending",
        input_key: SAMPLE_S3_KEY,
        correlation_id: correlationId,
      },
    ]);
    if (insErr) throw insErr;

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          job_id: jobId,
          user_id: userId,
          job_type: "pdf_structure",
          payload: {
            s3Key: SAMPLE_S3_KEY,
            asignatura: "control-alimentario",
          },
          correlation_id: correlationId,
          created_at: createdAt,
        }),
      })
    );
    const enqueueMs = Math.round(performance.now() - t0);
    const observedStatuses = new Set(["pending"]);

    let finalRow = null;
    while (performance.now() - t0 < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: row } = await sb
        .from("async_jobs")
        .select("status, result_url, result_payload, error_message, attempts")
        .eq("id", jobId)
        .single();
      if (!row) continue;
      observedStatuses.add(row.status);
      if (row.status === "completed" || row.status === "failed") {
        finalRow = row;
        break;
      }
    }

    const totalMs = Math.round(performance.now() - t0);
    const entry = {
      run: i,
      jobId,
      status: finalRow?.status || "timeout",
      enqueueMs,
      totalMs,
      observedStatuses: Array.from(observedStatuses),
      totalCards: finalRow?.result_payload?.total_cards ?? null,
      hasS3Report: Boolean(finalRow?.result_url),
      attempts: finalRow?.attempts ?? 0,
      error: finalRow?.error_message ?? null,
    };
    runs.push(entry);
    console.log(
      `[Run ${i}/${RUNS}] status=${entry.status} | enqueue=${entry.enqueueMs}ms | e2e=${entry.totalMs}ms | cards=${entry.totalCards} | s3Report=${entry.hasS3Report} | states=${entry.observedStatuses.join("->")}${entry.error ? " | err=" + entry.error : ""}`
    );
  }

  const completed = runs.filter((r) => r.status === "completed");
  const enqueueLatencies = completed.map((r) => r.enqueueMs).sort((a, b) => a - b);
  const coldStartMs = completed[0]?.totalMs ?? null;
  const warmRuns = completed.slice(1).map((r) => r.totalMs).sort((a, b) => a - b);
  const warmAvgMs =
    warmRuns.length > 0
      ? Math.round(warmRuns.reduce((a, b) => a + b, 0) / warmRuns.length)
      : null;

  const summary = {
    timestamp: new Date().toISOString(),
    region,
    totalRuns: RUNS,
    completedRuns: completed.length,
    failedRuns: runs.length - completed.length,
    enqueue_p50_ms: percentile(enqueueLatencies, 50),
    enqueue_p95_ms: percentile(enqueueLatencies, 95),
    lambda_cold_start_e2e_ms: coldStartMs,
    lambda_warm_p50_ms: percentile(warmRuns, 50),
    lambda_warm_p95_ms: percentile(warmRuns, 95),
    lambda_warm_avg_ms: warmAvgMs,
    runs,
  };

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (completed.length !== RUNS) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
