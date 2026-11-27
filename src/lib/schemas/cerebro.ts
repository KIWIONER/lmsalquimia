import { z } from "zod";

export const CerebroChatRequestSchema = z
  .object({
    action: z.literal("chat").optional().default("chat"),
    query: z.string().trim().min(1).max(2000).optional(),
    chatInput: z.string().trim().min(1).max(2000).optional(),
    sessionId: z.string().trim().min(1).max(120).optional(),
    topics: z.array(z.string().trim().min(1)).max(20).optional(),
    ramaCientifica: z.string().trim().min(1).max(80).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.query && !data.chatInput) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["query"],
        message: "Se requiere 'query' o 'chatInput' (1-2000 caracteres).",
      });
    }
  });

export const CerebroQuizRequestSchema = z
  .object({
    action: z.literal("generate_quiz"),
    topics: z.array(z.string().trim().min(1)).max(20).optional(),
    selectedTopics: z.array(z.string().trim().min(1)).max(20).optional(),
    difficulty: z.number().int().min(1).max(10).default(5),
    numQuestions: z.number().int().min(1).max(30).default(10),
    mode: z.enum(["practice", "exam"]).default("practice"),
    sessionId: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const resolvedTopics = data.selectedTopics ?? data.topics ?? [];
    if (resolvedTopics.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["topics"],
        message: "Se requiere al menos un tema en 'topics' o 'selectedTopics'.",
      });
    }
  });

export type CerebroChatRequest = z.infer<typeof CerebroChatRequestSchema>;
export type CerebroQuizRequest = z.infer<typeof CerebroQuizRequestSchema>;

export function parseCerebroRequest(raw: unknown) {
  if (
    raw &&
    typeof raw === "object" &&
    "action" in raw &&
    (raw as { action?: unknown }).action === "generate_quiz"
  ) {
    return CerebroQuizRequestSchema.safeParse(raw);
  }
  return CerebroChatRequestSchema.safeParse(raw);
}
