import { createHash } from "node:crypto";
import { getRedisConfig, redisCommand } from "@/lib/redis/client";

export type RateLimitFeature = "chat" | "quiz";

const FEATURE_LIMITS: Record<RateLimitFeature, { max: number; windowSec: number }> = {
  chat: { max: 30, windowSec: 3600 },
  quiz: { max: 10, windowSec: 3600 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function checkRateLimit(
  userId: string,
  feature: RateLimitFeature
): Promise<RateLimitResult> {
  const { max, windowSec } = FEATURE_LIMITS[feature];
  if (!getRedisConfig()) {
    return { allowed: true, remaining: max, retryAfterSeconds: 0 };
  }

  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const key = `rl:${feature}:${userId}:${bucket}`;

  try {
    const count = await redisCommand<number>(["INCR", key]);
    if (count === 1) {
      await redisCommand(["EXPIRE", key, windowSec]);
    }
    const current = typeof count === "number" ? count : 1;
    if (current > max) {
      const ttl = await redisCommand<number>(["TTL", key]);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: typeof ttl === "number" && ttl > 0 ? ttl : windowSec,
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, max - current),
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.warn("Redis rate limit fallback (fail-open):", err);
    return { allowed: true, remaining: max, retryAfterSeconds: 0 };
  }
}

export function buildKnowledgeCacheKey(params: {
  action: string;
  topics?: string[];
  difficulty?: number;
  query?: string;
  promptVersion?: string;
}): string {
  const normalizedTopics = [...(params.topics ?? [])].sort().join(",");
  const normalizedQuery = (params.query ?? "").trim().toLowerCase();
  const raw = `${params.action}|${normalizedTopics}|${params.difficulty ?? ""}|${normalizedQuery}|${params.promptVersion ?? "v1"}`;
  const digest = createHash("sha256").update(raw).digest("hex");
  return `cache:cerebro:${digest}`;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!getRedisConfig()) return null;
  try {
    const raw = await redisCommand<string | null>(["GET", key]);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds = 86400
): Promise<void> {
  if (!getRedisConfig()) return;
  try {
    await redisCommand(["SET", key, JSON.stringify(value), "EX", ttlSeconds]);
  } catch (err) {
    console.warn("Redis cache write skipped:", err);
  }
}
