import { test, expect } from "@playwright/test";

test.describe("Evaluación adaptativa en /evaluacion", () => {
  test("carga /evaluacion con stub determinista para generación de quiz", async ({ page }) => {
    await page.route("**/api/cerebro", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "q-e2e-1",
            question: "¿Dónde ocurre la glucólisis?",
            options: ["Citosol", "Núcleo", "Lisosoma", "Aparato de Golgi"],
            correctAnswer: 0,
            explanation: "La vía glucolítica ocurre en el citosol celular.",
          },
        ]),
      });
    });

    await page.goto("/evaluacion");
    await expect(page).toHaveURL(/\/evaluacion/);
    await expect(page.locator("body")).toBeVisible();
  });
});
