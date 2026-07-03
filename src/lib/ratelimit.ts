/**
 * Rate Limiting Module — Server-side (Node.js Runtime)
 *
 * This module provides rate limiting for route handlers that run on
 * Node.js runtime (non-Edge). For Edge middleware rate limiting,
 * see edge-ratelimit.ts which uses Upstash Redis.
 *
 * This is used as defense-in-depth alongside the Edge middleware.
 *
 * IMPORTANT: Redis is OPTIONAL. If UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are not configured, all rate limiting
 * functions fail-open (allow the request) instead of crashing.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Redis Setup (optional) ──────────────────────────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let _redisInitError: string | null = null;

if (REDIS_URL && REDIS_TOKEN) {
  try {
    redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  } catch (err: any) {
    _redisInitError = err.message;
    console.warn("[ratelimit] Redis init failed:", _redisInitError);
    redis = null;
  }
} else {
  console.log("[ratelimit] Redis not configured — rate limiting disabled (fail-open)");
}

// ─── Pre-configured Rate Limiters ─────────────────────────────────────────────

let loginRatelimit: Ratelimit | null = null;
let registerRatelimit: Ratelimit | null = null;
let passwordChangeRatelimit: Ratelimit | null = null;
let apiRatelimit: Ratelimit | null = null;

if (redis) {
  loginRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "5 m"),
    prefix: "ratelimit:auth:login",
    analytics: true,
  });

  registerRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "15 m"),
    prefix: "ratelimit:auth:register",
    analytics: true,
  });

  passwordChangeRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:user:password",
    analytics: true,
  });

  apiRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit:api:general",
    analytics: true,
  });
}

export { loginRatelimit, registerRatelimit, passwordChangeRatelimit, apiRatelimit };

// ─── IP Blocking (Server-side) ────────────────────────────────────────────────

const BLOCKLIST_PREFIX = "blocklist:ip:";

/**
 * Check if an IP is blocked (server-side).
 * Reuses the same Redis keys as edge-ratelimit.ts for consistency.
 * Fail-open if Redis is not available.
 */
export async function isIPBlockedServer(ip: string): Promise<{
  blocked: boolean;
  reason?: string;
  expiresAt?: number;
}> {
  if (!redis) return { blocked: false };

  try {
    const data = await redis.get<{ reason: string; expiresAt: number }>(
      `${BLOCKLIST_PREFIX}${ip}`
    );
    if (!data) return { blocked: false };

    if (Date.now() > data.expiresAt) {
      await redis.del(`${BLOCKLIST_PREFIX}${ip}`);
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: data.reason,
      expiresAt: data.expiresAt,
    };
  } catch {
    return { blocked: false };
  }
}

/**
 * Block an IP address for a specified duration.
 */
export async function blockIPServer(
  ip: string,
  reason: string,
  durationSeconds: number = 30 * 60
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      `${BLOCKLIST_PREFIX}${ip}`,
      { reason, expiresAt: Date.now() + durationSeconds * 1000 },
      { ex: durationSeconds }
    );
  } catch {
    // Best effort
  }
}

/**
 * Get all currently blocked IPs (for admin dashboard).
 */
export async function getBlockedIPs(): Promise<
  Array<{ ip: string; reason: string; expiresAt: number }>
> {
  if (!redis) return [];

  try {
    const results: Array<{ ip: string; reason: string; expiresAt: number }> = [];
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        match: `${BLOCKLIST_PREFIX}*`,
        count: 100,
      });
      cursor = nextCursor;

      if (keys.length > 0) {
        const values = await Promise.all(
          keys.map((key) =>
            redis.get<{ reason: string; expiresAt: number }>(key)
          )
        );
        for (let i = 0; i < keys.length; i++) {
          const data = values[i];
          if (data && Date.now() < data.expiresAt) {
            results.push({
              ip: keys[i].replace(BLOCKLIST_PREFIX, ""),
              reason: data.reason,
              expiresAt: data.expiresAt,
            });
          }
        }
      }
    } while (cursor !== 0);

    return results;
  } catch {
    return [];
  }
}

// ─── Convenience: Combined Rate Limit Check ───────────────────────────────────

export interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  limit: number;
}

/**
 * Check a rate limiter and return a standardized result.
 * Fail-open if Redis or the limiter is not available.
 */
export async function checkRateLimitRedis(
  limiter: Ratelimit | null,
  identifier: string
): Promise<RateLimitCheckResult> {
  if (!limiter || !redis) {
    return { allowed: true, remaining: 999, limit: 999 };
  }

  try {
    const result = await limiter.limit(identifier);
    return {
      allowed: result.success,
      remaining: result.remaining,
      retryAfter: result.success
        ? undefined
        : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      limit: result.limit,
    };
  } catch {
    // Redis failure — fail open
    return { allowed: true, remaining: 999, limit: 999 };
  }
}
