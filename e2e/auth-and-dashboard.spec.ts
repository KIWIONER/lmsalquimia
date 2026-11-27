import { test, expect } from "@playwright/test";

test.describe("Auth y aislamiento de rutas", () => {
  test("renderiza /login y bloquea mutaciones /api/admin/upload sin sesión admin", async ({
    page,
    request,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Acceso a Alquimia LMS/i })).toBeVisible();

    const adminRes = await request.post("/api/admin/upload");
    expect(adminRes.status()).toBe(401);

    const presignRes = await request.post("/api/storage/presign", {
      data: {
        operation: "upload",
        prefix: "uploads/pdfs",
        fileName: "test.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      },
    });
    expect(presignRes.status()).toBe(401);
  });
});
