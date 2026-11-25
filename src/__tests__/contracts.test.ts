import { describe, expect, it } from "vitest";
import { parseCerebroRequest } from "@/lib/schemas/cerebro";
import { PresignRequestSchema } from "@/lib/aws/jobContracts";

describe("Contratos Zod default-deny (Cerebro y AWS Presign)", () => {
  it("acepta chat válido y rechaza campos extra o query vacía", () => {
    const ok = parseCerebroRequest({ query: "¿Qué es el gasto energético basal?" });
    expect(ok.success).toBe(true);

    const extraField = parseCerebroRequest({
      query: "Hola",
      injectedRole: "admin",
    });
    expect(extraField.success).toBe(false);

    const emptyQuery = parseCerebroRequest({ query: "   " });
    expect(emptyQuery.success).toBe(false);
  });

  it("acepta generate_quiz válido y rechaza dificultad fuera de rango", () => {
    const ok = parseCerebroRequest({
      action: "generate_quiz",
      topics: ["nutricion"],
      difficulty: 7,
      numQuestions: 10,
    });
    expect(ok.success).toBe(true);

    const bad = parseCerebroRequest({
      action: "generate_quiz",
      topics: ["nutricion"],
      difficulty: 99,
    });
    expect(bad.success).toBe(false);
  });

  it("bloquea path traversal y MIME no PDF en PresignRequestSchema", () => {
    const valid = PresignRequestSchema.safeParse({
      operation: "upload",
      prefix: "uploads/pdfs",
      fileName: "bioquimica_cap1.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(valid.success).toBe(true);

    const traversal = PresignRequestSchema.safeParse({
      operation: "upload",
      prefix: "uploads/pdfs",
      fileName: "../secret.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    });
    expect(traversal.success).toBe(false);

    const wrongMime = PresignRequestSchema.safeParse({
      operation: "upload",
      prefix: "uploads/pdfs",
      fileName: "payload.html",
      contentType: "text/html",
      sizeBytes: 1024,
    });
    expect(wrongMime.success).toBe(false);
  });
});
