/**
 * Edge Runtime Rate Limiter for Vercel
 *
 * Uses Upstash Redis for distributed state across serverless functions.
 * This module is fully Edge-compatible (no Node.js APIs).
 *
 * IMPORTANT: Redis is OPTIONAL. If UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are not configured, all rate limiting
 * functions fail-open (allow the request) instead of crashing.
 *
 * Rate Limit Tiers (adjusted for production — avoids false positives):
 *   - Login:    5 attempts / 5 minutes per IP
 *   - Register: 3 registrations / 15 minutes per IP
 *   - Light (logout/me): 60 requests / 1 minute per IP
 *
 * IP Blocking:
 *   - Progressive escalation: 5min → 15min → 30min → 60min
 *   - Only triggered after 5+ violations (not 3)
 *   - Violations reset after 1 hour of good behavior
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Redis Setup (optional) ──────────────────────────────────────────────────

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;

if (REDIS_URL && REDIS_TOKEN) {
  try {
    redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  } catch (err: any) {
    console.warn("[edge-ratelimit] Redis init failed:", err.message);
    redis = null;
  }
} else {
  console.log("[edge-ratelimit] Redis not configured — rate limiting disabled (fail-open)");
}

/** Export Redis instance for reuse in proxy and other Edge modules */
export function getRedis(): Redis | null {
  return redis;
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

let loginLimiter: Ratelimit | null = null;
let registerLimiter: Ratelimit | null = null;
let authLightLimiter: Ratelimit | null = null;

if (redis) {
  /** Login-specific: 5 attempts per 5 minutes */
  loginLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "5 m"),
    prefix: "ratelimit:auth:login",
    analytics: true,
  });

  /** Register-specific: 3 registrations per 15 minutes */
  registerLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(3, "15 m"),
    prefix: "ratelimit:auth:register",
    analytics: true,
  });

  /** Logout/me: 60 req/min per IP (lightweight endpoints — generous limit) */
  authLightLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:auth:light",
    analytics: true,
  });
}

export { loginLimiter, registerLimiter, authLightLimiter };

// ─── IP Blocklist ─────────────────────────────────────────────────────────────

const BLOCKLIST_PREFIX = "blocklist:ip:";
const DEFAULT_BLOCK_DURATION = 5 * 60; // 5 minutes (first offense)

/**
 * Check if an IP is currently blocked.
 * Fail-open if Redis is not available.
 */
export async function isIPBlocked(ip: string): Promise<{
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
      // Expired — clean up
      await redis.del(`${BLOCKLIST_PREFIX}${ip}`);
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: data.reason,
      expiresAt: data.expiresAt,
    };
  } catch {
    // Fail-open: if Redis is down, don't block legitimate users
    return { blocked: false };
  }
}

/**
 * Block an IP for a given duration.
 * Called when an IP exceeds rate limits repeatedly.
 */
export async function blockIP(
  ip: string,
  reason: string,
  durationSeconds: number = DEFAULT_BLOCK_DURATION
): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(
      `${BLOCKLIST_PREFIX}${ip}`,
      { reason, expiresAt: Date.now() + durationSeconds * 1000 },
      { ex: durationSeconds }
    );
  } catch {
    // Silently fail — best effort
  }
}

/**
 * Unblock an IP manually (for admin use).
 */
export async function unblockIP(ip: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(`${BLOCKLIST_PREFIX}${ip}`);
    // Also clear violations
    await redis.del(`violations:${ip}`);
  } catch {
    // Silently fail
  }
}

// ─── Turnstile Verification (Edge-compatible) ────────────────────────────────

/**
 * Verify Cloudflare Turnstile token server-side.
 * Edge-compatible: uses standard fetch API only.
 *
 * IMPORTANT: This should ONLY be called from route handlers, NOT from middleware.
 * Turnstile tokens are single-use — verifying in both middleware and route handler
 * causes the second verification to always fail with "timeout-or-duplicate".
 */
export async function verifyTurnstileEdge(
  token: string,
  ip: string
): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // In production, fail closed — reject if CAPTCHA not configured
    if (process.env.NODE_ENV === "production") {
      console.error("[SECURITY] TURNSTILE_SECRET_KEY not set in production — rejecting request");
      return { success: false, error: "Verificación no configurada" };
    }
    // Dev mode: skip verification
    return { success: true };
  }

  if (!token || token.length < 10) {
    return { success: false, error: "Token de verificación requerido" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: ip,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: "Error de verificación" };
    }

    const data = await res.json();

    if (data.success === true) {
      return { success: true };
    }

    // Map error codes to user-friendly messages
    const errorCodes: string[] = data["error-codes"] || [];
    const reason = errorCodes.includes("timeout-or-duplicate")
      ? "Verificación expirada, intenta de nuevo"
      : errorCodes.includes("invalid-input-response")
        ? "Token de verificación inválido"
        : "Verificación fallida";

    return { success: false, error: reason };
  } catch {
    // Network error — don't block the user, let them retry
    return { success: false, error: "Error de conexión con verificación" };
  }
}

// ─── Helper: Get Client IP (Edge-compatible) ─────────────────────────────────

export function getClientIPEdge(request: Request): string {
  // Use trusted headers first (Vercel/Cloudflare set these directly)
  const vercelIP = request.headers.get("x-vercel-forwarded-for");
  if (vercelIP) return vercelIP.split(",")[0]?.trim() || "unknown";
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  // x-forwarded-for is easily spoofed — only use as last resort
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[ips.length - 1] || "unknown";
  }
  return "unknown";
}

// ─── Route-specific limiter selection ─────────────────────────────────────────

export type AuthRouteType = "login" | "register" | "logout" | "me" | "other";

export function getAuthRouteLimiter(routeType: AuthRouteType): Ratelimit | null {
  switch (routeType) {
    case "login":
      return loginLimiter;
    case "register":
      return registerLimiter;
    case "logout":
    case "me":
      return authLightLimiter;
    default:
      return authLightLimiter;
  }
}

export function classifyAuthRoute(pathname: string): AuthRouteType {
  if (pathname.includes("/auth/login")) return "login";
  if (pathname.includes("/auth/register")) return "register";
  if (pathname.includes("/auth/logout")) return "logout";
  if (pathname.includes("/auth/me")) return "me";
  return "other";
}
