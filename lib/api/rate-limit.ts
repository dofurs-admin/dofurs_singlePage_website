const buckets = new Map<string, { count: number; resetAt: number }>();

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

export function isRateLimited(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  current.count += 1;
  buckets.set(key, current);

  const remaining = Math.max(0, config.maxRequests - current.count);
  return {
    limited: current.count > config.maxRequests,
    remaining,
    resetAt: current.resetAt,
  };
}

export function getRateLimitKey(scope: string, userId: string) {
  return `${scope}:${userId}`;
}
