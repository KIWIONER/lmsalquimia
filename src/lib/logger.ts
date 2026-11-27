import { randomUUID } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  correlation_id: string;
  route?: string;
  user_id?: string;
  duration_ms?: number;
  message: string;
  meta?: Record<string, unknown>;
}

export function formatStructuredLog(entry: StructuredLogEntry): string {
  return JSON.stringify(entry);
}

export function createRequestLogger(route: string, correlationId?: string, userId?: string) {
  const corrId = correlationId || randomUUID();
  const startedAt = performance.now();

  const emit = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const payload: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: "alquimia-nextjs",
      correlation_id: corrId,
      route,
      user_id: userId,
      duration_ms: Math.round((performance.now() - startedAt) * 100) / 100,
      message,
      ...(meta ? { meta } : {}),
    };
    const line = formatStructuredLog(payload);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.info(line);
    }
    return payload;
  };

  return {
    correlationId: corrId,
    info: (message: string, meta?: Record<string, unknown>) => emit("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => emit("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => emit("error", message, meta),
  };
}
