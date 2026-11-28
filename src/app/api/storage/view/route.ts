import { NextResponse, type NextRequest } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/auth/adminAuth";
import { getS3BucketName, getS3Client } from "@/lib/aws/clients";
import { ALLOWED_S3_PREFIXES, PRESIGN_EXPIRES_SECONDS } from "@/lib/aws/jobContracts";

export const dynamic = "force-dynamic";

async function hasAuthenticatedSession(request: NextRequest): Promise<boolean> {
  const adminToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (adminToken) {
    const adminSession = await verifyAdminToken(adminToken);
    if (adminSession?.email) return true;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user?.id);
}

function sanitizeS3Key(rawKey: string | null): string | null {
  if (!rawKey) return null;
  let key = rawKey.trim();
  if (key.startsWith("s3://")) {
    const withoutScheme = key.slice(5);
    const slashIdx = withoutScheme.indexOf("/");
    if (slashIdx === -1) return null;
    key = withoutScheme.slice(slashIdx + 1);
  }
  key = key.replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) return null;
  const allowedPrefix = ALLOWED_S3_PREFIXES.some((p) => key.startsWith(`${p}/`));
  if (!allowedPrefix || !key.toLowerCase().endsWith(".pdf")) return null;
  return key;
}

export async function GET(request: NextRequest) {
  try {
    const isAuth = await hasAuthenticatedSession(request);
    if (!isAuth) {
      return NextResponse.json(
        { error: "No autorizado. Se requiere sesión autenticada." },
        { status: 401 }
      );
    }

    const rawKey = request.nextUrl.searchParams.get("key");
    const key = sanitizeS3Key(rawKey);
    if (!key) {
      return NextResponse.json(
        { error: "Clave S3 inválida o fuera de los prefijos permitidos." },
        { status: 400 }
      );
    }

    const bucket = getS3BucketName();
    const s3 = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: "inline",
      ResponseContentType: "application/pdf",
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    console.error("Storage View Error:", error);
    return NextResponse.json(
      { error: "No se pudo resolver la visualización del PDF.", details: message },
      { status: 500 }
    );
  }
}
