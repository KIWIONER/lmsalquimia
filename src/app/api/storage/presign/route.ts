import { NextResponse, type NextRequest } from "next/server";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { getS3BucketName, getS3Client } from "@/lib/aws/clients";
import {
  PRESIGN_EXPIRES_SECONDS,
  PresignRequestSchema,
  buildS3ObjectKey,
} from "@/lib/aws/jobContracts";

export const dynamic = "force-dynamic";

async function resolveAuthenticatedActorId(request: NextRequest): Promise<string | null> {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken) {
    const adminSession = await verifyAdminToken(adminToken);
    if (adminSession?.email) {
      return `admin_${adminSession.email.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const actorId = await resolveAuthenticatedActorId(request);
    if (!actorId) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión autenticada." },
        { status: 401 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = PresignRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Solicitud de Presigned URL inválida.",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { operation, prefix, fileName, contentType } = parsed.data;
    const bucket = getS3BucketName();
    const s3 = getS3Client();
    const key = buildS3ObjectKey(prefix, actorId, fileName);

    const command =
      operation === "upload"
        ? new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
          })
        : new GetObjectCommand({
            Bucket: bucket,
            Key: key,
          });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    return NextResponse.json({
      url: signedUrl,
      key,
      operation,
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Presign Route Error:", error);
    return NextResponse.json(
      { error: "No se pudo generar la Presigned URL.", details: message },
      { status: 500 }
    );
  }
}
