/**
 * Rate Limiting Module — Server-side (Node.js Runtime)
 *
 * This module provides rate limiting for route handlers that run on
 * Node.js runtime (non-Edge). For Edge middleware rate limiting,
 * see edge-ratelimit.ts which uses Upstash Redis.
 *
 * This is used as defense-in-depth alongside the Edge middleware.
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Redis Setup ──────────────────────────────────────────────────────────────

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Pre-configured Rate Limiters ─────────────────────────────────────────────

/** Login rate limit: 5 attempts per 5 minutes (matches edge-ratelimit.ts) */
export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "ratelimit:auth:login",
  analytics: true,
});

/** Register rate limit: 3 per 15 minutes */
export const registerRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  prefix: "ratelimit:auth:register",
  analytics: true,
});

/** Password change: 5 per 15 minutes */
export const passwordChangeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"),
  prefix: "ratelimit:user:password",
  analytics: true,
});

/** Generic API rate limit: 30 per minute */
export const apiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:api:general",
  analytics: true,
});

// ─── IP Blocking (Server-side) ────────────────────────────────────────────────

const BLOCKLIST_PREFIX = "blocklist:ip:";

/**
 * Check if an IP is blocked (server-side).
 * Reuses the same Redis keys as edge-ratelimit.ts for consistency.
 */
export async function isIPBlockedServer(ip: string): Promise<{
  blocked: boolean;
  reason?: string;
  expiresAt?: number;
}> {
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
  try {
    const keys = await redis.keys(`${BLOCKLIST_PREFIX}*`);
    const results: Array<{ ip: string; reason: string; expiresAt: number }> = [];

    for (const key of keys) {
      const data = await redis.get<{ reason: string; expiresAt: number }>(key);
      if (data && Date.now() < data.expiresAt) {
        results.push({
          ip: key.replace(BLOCKLIST_PREFIX, ""),
          reason: data.reason,
          expiresAt: data.expiresAt,
        });
      }
    }

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
 * Returns { allowed, remaining, retryAfter, limit }
 */
export async function checkRateLimitRedis(
  limiter: Ratelimit,
  identifier: string
): Promise<RateLimitCheckResult> {
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
