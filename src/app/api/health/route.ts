import { NextResponse } from "next/server";
import { createRequestLogger } from "@/lib/logger";
import { getRedisConfig, redisCommand } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

type CheckState = "ok" | "error" | "not_configured";

interface DependencyCheck {
  status: CheckState;
  latency_ms?: number;
}

async function probeHttp(url: string, headers?: Record<string, string>): Promise<DependencyCheck> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    return {
      status: res.ok ? "ok" : "error",
      latency_ms: Math.round(performance.now() - t0),
    };
  } catch {
    return {
      status: "error",
      latency_ms: Math.round(performance.now() - t0),
    };
  }
}

async function checkSupabase(): Promise<DependencyCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("tu-proyecto")) {
    return { status: "not_configured" };
  }
  return probeHttp(`${url.replace(/\/+$/, "")}/rest/v1/`, { apikey: key });
}

async function checkRedis(): Promise<DependencyCheck> {
  if (!getRedisConfig()) {
    return { status: "not_configured" };
  }
  const t0 = performance.now();
  try {
    const res = await redisCommand<string>(["PING"]);
    return {
      status: res === "PONG" ? "ok" : "error",
      latency_ms: Math.round(performance.now() - t0),
    };
  } catch {
    return { status: "error", latency_ms: Math.round(performance.now() - t0) };
  }
}

async function checkQdrant(): Promise<DependencyCheck> {
  const url = process.env.QDRANT_URL?.trim();
  if (!url) {
    return { status: "not_configured" };
  }
  const headers: Record<string, string> = {};
  if (process.env.QDRANT_API_KEY) {
    headers["api-key"] = process.env.QDRANT_API_KEY;
  }
  return probeHttp(`${url.replace(/\/+$/, "")}/collections`, headers);
}

async function checkCerebroPy(): Promise<DependencyCheck> {
  const url = process.env.CEREBRO_PY_URL?.trim();
  if (!url) {
    return { status: "not_configured" };
  }
  return probeHttp(`${url.replace(/\/+$/, "")}/health`);
}

export async function GET(request: Request) {
  const log = createRequestLogger("/api/health", request.headers.get("x-correlation-id") || undefined);

  const [supabase, redis, qdrant, cerebro_py] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkQdrant(),
    checkCerebroPy(),
  ]);

  const dependencies = { supabase, redis, qdrant, cerebro_py };
  const hasCriticalFailure = supabase.status === "error";
  const httpStatus = hasCriticalFailure ? 503 : 200;
  const overallStatus = hasCriticalFailure
    ? "unhealthy"
    : Object.values(dependencies).some((d) => d.status === "error")
      ? "degraded"
      : "healthy";

  log.info("Healthcheck ejecutado", { status: overallStatus });

  return NextResponse.json(
    {
      status: overallStatus,
      service: "alquimia-nextjs",
      version: process.env.npm_package_version || "0.0.1",
      timestamp: new Date().toISOString(),
      uptime_s: Math.round(process.uptime()),
      correlation_id: log.correlationId,
      dependencies,
    },
    { status: httpStatus }
  );
}
