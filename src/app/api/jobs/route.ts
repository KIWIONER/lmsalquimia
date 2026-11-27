import { NextResponse, type NextRequest } from "next/server";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getSQSClient, getSQSQueueUrl } from "@/lib/aws/clients";
import { AsyncJobEnqueueSchema } from "@/lib/aws/jobContracts";

export const dynamic = "force-dynamic";

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
    );
  }
  return createSupabaseAdminClient(url, serviceKey);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión Supabase activa." },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = AsyncJobEnqueueSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Contrato de trabajo asíncrono inválido.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { jobType, payload } = parsed.data;
    const jobId = randomUUID();
    const correlationId = request.headers.get("x-correlation-id") || randomUUID();
    const createdAt = new Date().toISOString();
    const inputKey = "s3Key" in payload ? payload.s3Key : null;

    const serviceDb = getServiceSupabase();
    const { error: dbError } = await serviceDb.from("async_jobs").insert([
      {
        id: jobId,
        user_id: user.id,
        type: jobType,
        status: "pending",
        input_key: inputKey,
        correlation_id: correlationId,
      },
    ]);

    if (dbError) {
      console.error("Error insertando async_job en Supabase:", dbError);
      return NextResponse.json(
        { error: "No se pudo registrar el trabajo en base de datos." },
        { status: 500 }
      );
    }

    try {
      const sqs = getSQSClient();
      const queueUrl = getSQSQueueUrl();
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({
            job_id: jobId,
            user_id: user.id,
            job_type: jobType,
            payload,
            correlation_id: correlationId,
            created_at: createdAt,
          }),
        })
      );
    } catch (sqsError: unknown) {
      const details = sqsError instanceof Error ? sqsError.message : "Error SQS";
      await serviceDb
        .from("async_jobs")
        .update({ status: "failed", error_message: `Error encolando en SQS: ${details}` })
        .eq("id", jobId);

      return NextResponse.json(
        { error: "No se pudo encolar el trabajo en SQS.", jobId },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        jobId,
        status: "pending",
        jobType,
        correlationId,
        createdAt,
      },
      { status: 202 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("POST /api/jobs Error:", error);
    return NextResponse.json(
      { error: "Error procesando solicitud asíncrona.", details: message },
      { status: 500 }
    );
  }
}
