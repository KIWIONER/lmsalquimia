import { NextResponse } from 'next/server';

/**
 * @deprecated Endpoint legacy de integración con n8n retirado.
 * La ingesta de PDFs y sincronización de tarjetas se realiza vía
 * AWS S3 Presigned URLs + SQS + Lambda (cerebro-py) + Qdrant.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Gone',
      message:
        'El endpoint legacy de integración con n8n ha sido retirado. Usa POST /api/jobs (S3 + SQS + Lambda).',
    },
    { status: 410 }
  );
}
