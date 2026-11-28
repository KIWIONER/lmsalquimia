import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateAdminCredentials } from "@/lib/auth/adminAuth";

describe("adminAuth — Demo Mode opt-in", () => {
  const originalEnableDemo = process.env.ENABLE_DEMO_MODE;

  beforeEach(() => {
    delete process.env.ENABLE_DEMO_MODE;
  });

  afterEach(() => {
    if (originalEnableDemo === undefined) {
      delete process.env.ENABLE_DEMO_MODE;
    } else {
      process.env.ENABLE_DEMO_MODE = originalEnableDemo;
    }
  });

  it("rejects demo teacher credentials when ENABLE_DEMO_MODE is unset", () => {
    expect(validateAdminCredentials("profesor.demo@alquimia.es", "DemoProfesor2026!")).toBeNull();
  });

  it("rejects demo teacher credentials when ENABLE_DEMO_MODE is false", () => {
    process.env.ENABLE_DEMO_MODE = "false";
    expect(validateAdminCredentials("profesor.demo@alquimia.es", "DemoProfesor2026!")).toBeNull();
  });

  it("accepts demo teacher credentials only when ENABLE_DEMO_MODE is true", () => {
    process.env.ENABLE_DEMO_MODE = "true";
    expect(validateAdminCredentials("profesor.demo@alquimia.es", "DemoProfesor2026!")).toBe(
      "demo_teacher"
    );
  });
});
