export interface RedisRestConfig {
  url: string;
  token: string;
}

export function getRedisConfig(): RedisRestConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), token };
}

export async function redisCommand<T = unknown>(
  args: (string | number)[]
): Promise<T | null> {
  const cfg = getRedisConfig();
  if (!cfg) {
    return null;
  }

  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Upstash Redis error HTTP ${res.status}`);
  }

  const data = (await res.json()) as { result?: T; error?: string };
  if (data.error) {
    throw new Error(`Upstash Redis error: ${data.error}`);
  }
  return data.result ?? null;
}
