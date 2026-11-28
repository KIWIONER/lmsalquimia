import { NextResponse, type NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { createClient } from "@/lib/supabase/server";
import { getS3BucketName, getS3Client, getSQSClient, getSQSQueueUrl } from "@/lib/aws/clients";
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

async function resolveJobUserId(
  serviceDb: ReturnType<typeof getServiceSupabase>,
  supabaseUserId?: string
): Promise<string> {
  if (supabaseUserId) return supabaseUserId;
  if (process.env.ADMIN_AUTH_USER_ID) return process.env.ADMIN_AUTH_USER_ID;
  const { data, error } = await serviceDb.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error || !data?.users?.length) {
    throw new Error("No se encontró un usuario válido en auth.users para asociar el job.");
  }
  return data.users[0].id;
}

async function runLocalPdfJob(params: {
  serviceDb: ReturnType<typeof getServiceSupabase>;
  jobId: string;
  s3Key: string;
  documentoId?: string;
  mode: "local_gpu" | "prod_api";
}) {
  const { serviceDb, jobId, s3Key, documentoId, mode } = params;
  try {
    await serviceDb
      .from("async_jobs")
      .update({ status: "processing", attempts: 1 })
      .eq("id", jobId);

    const bucket = getS3BucketName();
    const signedUrl = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      { expiresIn: 300 }
    );

    const cerebroPyUrl = process.env.CEREBRO_PY_URL || "http://127.0.0.1:8155";
    const pyRes = await fetch(`${cerebroPyUrl}/api/pdf/structure-4layers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: signedUrl, mode }),
    });
    if (!pyRes.ok) {
      const errText = await pyRes.text();
      throw new Error(`cerebro-py error (${pyRes.status}): ${errText}`);
    }

    const pyData = await pyRes.json();
    const cards: any[] = Array.isArray(pyData.cards) ? pyData.cards : [];
    const report = pyData.report || {};

    if (documentoId && cards.length > 0) {
      const joinedContent = cards
        .map((c: any) => `## ${c.titulo}\n${c.contenido}`)
        .join("\n\n");
      await serviceDb
        .schema("nutricionista")
        .from("documentos")
        .update({
          contenido: joinedContent,
          verification_report: report,
        })
        .eq("id", documentoId);

      await serviceDb
        .schema("nutricionista")
        .from("tarjetas")
        .delete()
        .eq("documento_id", documentoId);

      const rows = cards.map((c: any, idx: number) => ({
        documento_id: documentoId,
        titulo: c.titulo || `Tema #${idx + 1}`,
        contenido: c.contenido || "",
        orden: c.orden ?? idx,
        needs_review: true,
        updated_at: new Date().toISOString(),
      }));
      await serviceDb.schema("nutricionista").from("tarjetas").insert(rows);
    }

    await serviceDb
      .from("async_jobs")
      .update({
        status: "completed",
        result_payload: {
          total_cards: cards.length,
          verification_report: report,
          mode,
          documento_id: documentoId || null,
        },
      })
      .eq("id", jobId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error procesando PDF en local";
    await serviceDb
      .from("async_jobs")
      .update({ status: "failed", error_message: msg })
      .eq("id", jobId);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const adminSession = adminToken ? await verifyAdminToken(adminToken) : null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !adminSession) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión Supabase o de administrador." },
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

    if (adminSession?.role === "demo_teacher") {
      const targetDocId = "documentoId" in payload ? payload.documentoId : undefined;
      if (jobType !== "pdf_structure" || !targetDocId) {
        return NextResponse.json(
          { error: "En modo Demo Profesor solo se permite probar el procesado del PDF de muestra." },
          { status: 403 }
        );
      }
      const { data: docRow } = await serviceDb
        .schema("nutricionista")
        .from("documentos")
        .select("carpeta")
        .eq("id", targetDocId)
        .maybeSingle();
      if (!docRow || docRow.carpeta !== "demo-muestra") {
        return NextResponse.json(
          { error: "En modo Demo Profesor solo se permite procesar la unidad de muestra." },
          { status: 403 }
        );
      }
    }

    const jobUserId = await resolveJobUserId(serviceDb, user?.id);

    const { error: dbError } = await serviceDb.from("async_jobs").insert([
      {
        id: jobId,
        user_id: jobUserId,
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

    const useLocalGpu =
      jobType === "pdf_structure" &&
      (process.env.USE_LOCAL_CEREBRO === "true" ||
        (process.env.NODE_ENV !== "production" &&
          "mode" in payload &&
          payload.mode === "local_gpu"));

    if (useLocalGpu && "s3Key" in payload) {
      void runLocalPdfJob({
        serviceDb,
        jobId,
        s3Key: payload.s3Key,
        documentoId: payload.documentoId,
        mode: "local_gpu",
      });

      return NextResponse.json(
        {
          jobId,
          status: "pending",
          jobType,
          executionMode: "local_gpu",
          correlationId,
          createdAt,
        },
        { status: 202 }
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
            user_id: jobUserId,
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
        executionMode: "sqs_lambda",
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
