/**
 * Next.js Edge Middleware — Anti-Bot & Rate Limiting
 *
 * Protects ALL /api/auth/* routes at the Edge before they reach
 * serverless function handlers. Runs on Vercel Edge Runtime.
 *
 * Protection layers (in order):
 * 1. IP Blocklist check (Redis-backed)
 * 2. Global auth rate limit (per IP)
 * 3. Route-specific rate limit (login=5/10m, register=3/15m, etc.)
 * 4. Cloudflare Turnstile verification (login & register only)
 * 5. Auto-block IPs that repeatedly exceed limits
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getClientIPEdge,
  classifyAuthRoute,
  getAuthRouteLimiter,
  authGlobalLimiter,
  isIPBlocked,
  blockIP,
  verifyTurnstileEdge,
} from "@/lib/edge-ratelimit";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Number of rate-limit violations before auto-blocking an IP */
const VIOLATIONS_BEFORE_BLOCK = 3;

/** Duration of auto-block in seconds */
const AUTO_BLOCK_DURATION = 30 * 60; // 30 min

/** Prefix for violation counter in Redis */
const VIOLATIONS_PREFIX = "violations:";

/** Routes that require Turnstile verification */
const TURNSTILE_ROUTES = new Set(["login", "register"]);

/** Paths protected by this middleware */
const PROTECTED_PREFIX = "/api/auth";

// ─── Violation Tracking ───────────────────────────────────────────────────────

async function incrementViolations(ip: string): Promise<number> {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const key = `${VIOLATIONS_PREFIX}${ip}`;
    const count = await redis.incr(key);

    // Set expiry on first violation (1 hour window)
    if (count === 1) {
      await redis.expire(key, 3600);
    }

    return count;
  } catch {
    return 0;
  }
}

// ─── Structured Edge Logging ──────────────────────────────────────────────────

function edgeLog(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown>
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };

  // Only log warn/error in production to reduce noise
  if (process.env.NODE_ENV === "production" && level === "info") return;

  const prefix = {
    info: "\x1b[36m[EDGE-INFO]\x1b[0m",
    warn: "\x1b[33m[EDGE-WARN]\x1b[0m",
    error: "\x1b[31m[EDGE-ERROR]\x1b[0m",
  }[level];

  console.log(`${prefix} ${event}`, JSON.stringify(entry));
}

// ─── 429 Response Builder ─────────────────────────────────────────────────────

function rateLimitResponse(retryAfter: number, reason: string): NextResponse {
  const body = {
    error: `Demasiadas solicitudes. Intenta en ${retryAfter} segundos.`,
    retryAfter,
    reason,
  };

  return NextResponse.json(body, {
    status: 429,
    headers: {
      "Retry-After": String(retryAfter),
      "X-RateLimit-Reason": reason,
      "Cache-Control": "no-store",
    },
  });
}

function blockResponse(reason: string, expiresAt?: number): NextResponse {
  const retryAfter = expiresAt
    ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000))
    : 900;

  return NextResponse.json(
    {
      error: "Acceso bloqueado temporalmente.",
      retryAfter,
      reason,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-Block-Reason": reason,
        "Cache-Control": "no-store",
      },
    }
  );
}

function turnstileFailResponse(error: string): NextResponse {
  return NextResponse.json(
    { error, turnstileFailed: true },
    {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

// ─── Main Middleware ──────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /api/auth/* routes
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Only rate-limit mutation methods (POST, PUT, DELETE, PATCH)
  // GET requests (like /api/auth/me) get lighter limits
  const method = request.method;
  if (!["POST", "PUT", "DELETE", "PATCH", "GET"].includes(method)) {
    return NextResponse.next();
  }

  const ip = getClientIPEdge(request);
  const routeType = classifyAuthRoute(pathname);

  edgeLog("info", "AUTH_REQUEST", { ip, routeType, method, pathname });

  // ─── Layer 1: IP Blocklist Check ──────────────────────────────────────────

  const blockCheck = await isIPBlocked(ip);
  if (blockCheck.blocked) {
    edgeLog("warn", "IP_BLOCKED", {
      ip,
      reason: blockCheck.reason,
      expiresAt: blockCheck.expiresAt,
    });

    return blockResponse(blockCheck.reason || "IP bloqueada", blockCheck.expiresAt);
  }

  // ─── Layer 2: Global Auth Rate Limit ──────────────────────────────────────

  try {
    const globalResult = await authGlobalLimiter.limit(ip);

    if (!globalResult.success) {
      edgeLog("warn", "GLOBAL_RATE_LIMITED", {
        ip,
        routeType,
        remaining: globalResult.remaining,
        reset: globalResult.reset,
      });

      // Track violation
      const violations = await incrementViolations(ip);
      if (violations >= VIOLATIONS_BEFORE_BLOCK) {
        await blockIP(ip, "Exceso de rate limit global", AUTO_BLOCK_DURATION);
        edgeLog("error", "IP_AUTO_BLOCKED", { ip, violations });
      }

      const retryAfter = Math.max(
        1,
        Math.ceil((globalResult.reset - Date.now()) / 1000)
      );
      return rateLimitResponse(retryAfter, "global_rate_limit");
    }
  } catch (err) {
    // Redis failure — fail-open, don't block legitimate users
    edgeLog("error", "GLOBAL_LIMITER_ERROR", {
      ip,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  // ─── Layer 3: Route-Specific Rate Limit ───────────────────────────────────

  const routeLimiter = getAuthRouteLimiter(routeType);

  try {
    const routeResult = await routeLimiter.limit(ip);

    if (!routeResult.success) {
      edgeLog("warn", "ROUTE_RATE_LIMITED", {
        ip,
        routeType,
        remaining: routeResult.remaining,
        reset: routeResult.reset,
      });

      // Track violation — auto-block repeat offenders
      const violations = await incrementViolations(ip);
      if (violations >= VIOLATIONS_BEFORE_BLOCK) {
        await blockIP(ip, `Rate limit excedido en ${routeType}`, AUTO_BLOCK_DURATION);
        edgeLog("error", "IP_AUTO_BLOCKED", { ip, violations, routeType });
      }

      const retryAfter = Math.max(
        1,
        Math.ceil((routeResult.reset - Date.now()) / 1000)
      );
      return rateLimitResponse(retryAfter, `${routeType}_rate_limit`);
    }
  } catch (err) {
    edgeLog("error", "ROUTE_LIMITER_ERROR", {
      ip,
      routeType,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  // ─── Layer 4: Turnstile Verification (login & register) ───────────────────

  if (TURNSTILE_ROUTES.has(routeType) && method === "POST") {
    try {
      const body = await request.clone().json();
      const turnstileToken = body?.turnstileToken;

      if (!turnstileToken) {
        edgeLog("warn", "TURNSTILE_MISSING", { ip, routeType });
        return turnstileFailResponse("Verificación de seguridad requerida");
      }

      const turnstileResult = await verifyTurnstileEdge(turnstileToken, ip);

      if (!turnstileResult.success) {
        edgeLog("warn", "TURNSTILE_FAILED", {
          ip,
          routeType,
          error: turnstileResult.error,
        });

        // Track as violation
        const violations = await incrementViolations(ip);
        if (violations >= VIOLATIONS_BEFORE_BLOCK) {
          await blockIP(ip, "Turnstile fallido repetidamente", AUTO_BLOCK_DURATION);
        }

        return turnstileFailResponse(turnstileResult.error || "Verificación fallida");
      }
    } catch {
      // If we can't parse the body, let the route handler deal with it
      edgeLog("warn", "TURNSTILE_PARSE_ERROR", { ip, routeType });
    }
  }

  // ─── Layer 5: Add rate-limit headers to response ─────────────────────────

  const response = NextResponse.next();

  // Tag response with request metadata for observability
  response.headers.set("X-Auth-Route-Type", routeType);
  response.headers.set("X-Request-IP", ip.slice(0, 20)); // Truncate for header size

  return response;
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Match all /api/auth/* routes
     * This includes: /api/auth/login, /api/auth/register, /api/auth/logout, /api/auth/me
     */
    "/api/auth/:path*",
  ],
};
