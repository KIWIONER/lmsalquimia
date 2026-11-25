import { describe, expect, it } from "vitest";
import { isIndexLine, isIndexTitle, isSectionHeader } from "@/lib/content";

describe("content.ts — Detección de títulos e índices", () => {
  it("reconoce encabezados de índice multilingües", () => {
    expect(isIndexTitle("Índice de Contenidos:")).toBe(true);
    expect(isIndexTitle("Táboa de contidos")).toBe(true);
    expect(isIndexTitle("Introducción al Metabolismo")).toBe(false);
  });

  it("identifica líneas de índice con puntos suspensivos o numeración de página", () => {
    expect(isIndexLine("1.2 Macronutrientes .......... 14")).toBe(true);
    expect(isIndexLine("2.1 Glucólisis aerobia 32")).toBe(true);
    expect(isIndexLine("El ATP se sintetiza en la mitocondria.")).toBe(false);
  });

  it("detecta cabeceras Markdown y unidades didácticas", () => {
    expect(isSectionHeader("## Metabolismo Energético")).toBe(true);
    expect(isSectionHeader("UD 2 - Micronutrientes esenciales")).toBe(true);
    expect(isSectionHeader("42")).toBe(false);
  });
});
