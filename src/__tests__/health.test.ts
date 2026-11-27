import { describe, expect, it, vi, beforeEach } from "vitest";
import { formatStructuredLog, createRequestLogger } from "@/lib/logger";
import { GET as healthGet } from "../app/api/health/route";

describe("Logger JSON y /api/health", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("emite logs estructurados parseables con JSON.parse y correlation_id", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = createRequestLogger("/api/test", "corr-test-123", "user-1");
    log.info("Evento de prueba", { ok: true });

    expect(spy).toHaveBeenCalledTimes(1);
    const rawLine = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(rawLine);
    expect(parsed.correlation_id).toBe("corr-test-123");
    expect(parsed.service).toBe("alquimia-nextjs");
    expect(parsed.route).toBe("/api/test");
    expect(parsed.message).toBe("Evento de prueba");

    const manual = JSON.parse(
      formatStructuredLog({
        timestamp: "2026-11-25T00:00:00Z",
        level: "warn",
        service: "alquimia-nextjs",
        correlation_id: "c1",
        message: "Aviso",
      })
    );
    expect(manual.level).toBe("warn");
  });

  it("GET /api/health responde JSON estructurado sin exponer secretos", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "healthy" }), { status: 200 }))
    );

    const req = new Request("http://127.0.0.1:3100/api/health", {
      headers: { "x-correlation-id": "health-corr-1" },
    });
    const res = await healthGet(req);
    const body = await res.json();

    expect([200, 503]).toContain(res.status);
    expect(body.service).toBe("alquimia-nextjs");
    expect(body.correlation_id).toBe("health-corr-1");
    expect(body.dependencies).toBeDefined();
    expect(JSON.stringify(body)).not.toContain("sb_secret_");
  });
});
