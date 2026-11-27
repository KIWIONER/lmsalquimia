import { z } from "zod";

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
export const PRESIGN_EXPIRES_SECONDS = 300; // 5 minutos

export const ALLOWED_S3_PREFIXES = [
  "uploads/pdfs",
  "generated/certificates",
  "generated/reports",
] as const;

export type AllowedS3Prefix = (typeof ALLOWED_S3_PREFIXES)[number];

const SafeFileNameSchema = z
  .string()
  .min(1, "fileName requerido")
  .max(180, "fileName demasiado largo")
  .regex(/^[a-zA-Z0-9._-]+$/, "fileName contiene caracteres no permitidos")
  .refine((val) => !val.includes(".."), "Path traversal no permitido")
  .refine((val) => val.toLowerCase().endsWith(".pdf"), "Solo se permiten archivos .pdf");

export const PresignRequestSchema = z
  .object({
    operation: z.enum(["upload", "download"]),
    prefix: z.enum(ALLOWED_S3_PREFIXES),
    fileName: SafeFileNameSchema,
    contentType: z.literal("application/pdf"),
    sizeBytes: z
      .number()
      .int()
      .min(1, "El archivo no puede estar vacío")
      .max(MAX_PDF_BYTES, "El archivo supera el límite de 25 MB")
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // Default-deny: los clientes solo pueden subir al prefijo de entrada uploads/pdfs
    if (data.operation === "upload" && data.prefix !== "uploads/pdfs") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prefix"],
        message: "Solo se permite subir archivos al prefijo uploads/pdfs.",
      });
    }
    if (data.operation === "upload" && data.sizeBytes === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sizeBytes"],
        message: "sizeBytes es obligatorio para operaciones de subida.",
      });
    }
  });

export const PdfStructurePayloadSchema = z
  .object({
    s3Key: z
      .string()
      .min(1)
      .refine((k) => k.startsWith("uploads/pdfs/"), "s3Key debe iniciar con uploads/pdfs/")
      .refine((k) => !k.includes(".."), "Path traversal no permitido")
      .refine((k) => k.toLowerCase().endsWith(".pdf"), "s3Key debe apuntar a un .pdf"),
    asignatura: z.string().min(1).max(120).optional(),
  })
  .strict();

export const GenerateQuizLongPayloadSchema = z
  .object({
    topics: z.array(z.string().min(1)).min(1, "Se requiere al menos un tema"),
    difficulty: z.number().int().min(1).max(10).default(5),
    numQuestions: z.number().int().min(5).max(50).default(15),
    mode: z.enum(["practice", "exam"]).default("practice"),
  })
  .strict();

export const ProgressReportPayloadSchema = z
  .object({
    periodDays: z.number().int().min(1).max(365).default(30),
  })
  .strict();

export const AsyncJobEnqueueSchema = z.discriminatedUnion("jobType", [
  z.object({
    jobType: z.literal("pdf_structure"),
    payload: PdfStructurePayloadSchema,
  }),
  z.object({
    jobType: z.literal("generate_quiz_long"),
    payload: GenerateQuizLongPayloadSchema,
  }),
  z.object({
    jobType: z.literal("progress_report"),
    payload: ProgressReportPayloadSchema,
  }),
]);

export type PresignRequest = z.infer<typeof PresignRequestSchema>;
export type AsyncJobEnqueueRequest = z.infer<typeof AsyncJobEnqueueSchema>;

export function buildS3ObjectKey(
  prefix: AllowedS3Prefix,
  userId: string,
  fileName: string
): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${prefix}/${safeUserId}/${Date.now()}_${fileName}`;
}
