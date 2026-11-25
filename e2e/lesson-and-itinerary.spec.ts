import { test, expect } from "@playwright/test";

test.describe("Biblioteca y consulta IA determinista", () => {
  test("navega a /biblioteca y responde /api/health en JSON", async ({ page, request }) => {
    await page.route("**/api/cerebro", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          response: "La glucólisis ocurre en el citosol. [[REFS:Bioquimica-Cap3]]",
        }),
      });
    });

    await page.goto("/biblioteca");
    await expect(page).toHaveURL(/\/biblioteca/);

    const healthRes = await request.get("/api/health");
    const healthJson = await healthRes.json();
    expect(healthJson.service).toBe("alquimia-nextjs");
    expect(healthJson.dependencies).toBeTruthy();
  });
});
