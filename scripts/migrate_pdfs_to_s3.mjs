import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
const SUPABASE_BUCKET = 'cerebro-nutricionista';

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const force = args.includes('--force');
const prefixArg = args.find((a) => a.startsWith('--prefix='));
const startPrefix = prefixArg ? prefixArg.split('=')[1].replace(/^\/+|\/+$/g, '') : 'dietetica-nutricion';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
if (!AWS_S3_BUCKET) {
  console.error('Falta AWS_S3_BUCKET en .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const s3 = new S3Client({ region: AWS_REGION });

async function listStorageRecursive(prefix = '') {
  const files = [];
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`Error listando Supabase Storage (${prefix}): ${error.message}`);
  if (!data) return files;

  for (const item of data) {
    const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
    // En Supabase Storage, las carpetas vienen con id === null
    if (item.id === null) {
      const nested = await listStorageRecursive(itemPath);
      files.push(...nested);
    } else if (!item.name.toLowerCase().includes('.emptyfolderplaceholder')) {
      files.push({
        path: itemPath,
        size: item.metadata?.size ?? null,
        mime: item.metadata?.mimetype ?? null,
      });
    }
  }
  return files;
}

async function existsInS3(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }));
    return true;
  } catch (err) {
    const code = err?.$metadata?.httpStatusCode;
    if (code === 404 || code === 403 || err?.name === 'NotFound') return false;
    throw err;
  }
}

function toS3Key(supabasePath) {
  const sanitized = supabasePath
    .split('/')
    .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('/');
  return `uploads/pdfs/biblioteca/${sanitized}`;
}

async function main() {
  console.log(`Modo: ${execute ? 'EXECUTE (subida real a S3)' : 'DRY-RUN (solo lectura)'}`);
  console.log(`Origen Supabase: ${SUPABASE_BUCKET}/${startPrefix || '(raíz)'}`);
  console.log(`Destino AWS S3 bucket:  ${AWS_S3_BUCKET} (${AWS_REGION})\n`);

  const allFiles = await listStorageRecursive(startPrefix);
  const pdfs = allFiles.filter((f) => f.path.toLowerCase().endsWith('.pdf'));

  const { data: docsDb, error: docsErr } = await supabase
    .schema('nutricionista')
    .from('documentos')
    .select('id, nombre, carpeta, url');

  console.log(`Archivos totales en bucket '${SUPABASE_BUCKET}': ${allFiles.length}`);
  console.log(`PDFs encontrados: ${pdfs.length}`);
  if (!docsErr && docsDb) {
    console.log(`Registros en nutricionista.documentos: ${docsDb.length}\n`);
  }

  let alreadyInS3 = 0;
  let uploaded = 0;
  let pending = 0;

  for (const pdf of pdfs) {
    const s3Key = toS3Key(pdf.path);
    const exists = await existsInS3(s3Key);
    const sizeKb = pdf.size ? `${(pdf.size / 1024).toFixed(1)} KB` : 'size?';

    if (exists && !force) {
      alreadyInS3++;
      console.log(`[SKIP - ya en S3] ${pdf.path} (${sizeKb}) -> ${s3Key}`);
      continue;
    }

    if (!execute) {
      pending++;
      console.log(`[PENDIENTE]      ${pdf.path} (${sizeKb}) -> ${s3Key}`);
      continue;
    }

    const { data: blob, error: dlErr } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(pdf.path);
    if (dlErr || !blob) {
      console.error(`[ERROR descarga] ${pdf.path}: ${dlErr?.message || 'sin datos'}`);
      continue;
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: 'application/pdf',
        ServerSideEncryption: 'AES256',
      })
    );
    uploaded++;
    console.log(`[SUBIDO OK]      ${pdf.path} (${(buffer.length / 1024).toFixed(1)} KB) -> ${s3Key}`);
  }

  console.log('\n--- Resumen ---');
  console.log(`Total PDFs: ${pdfs.length} | Ya en S3: ${alreadyInS3} | Pendientes: ${pending} | Subidos: ${uploaded}`);
}

main().catch((err) => {
  console.error('Error fatal:', err.message || err);
  process.exit(1);
});
