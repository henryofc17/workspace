/**
 * Next.js 16 Edge Proxy — Anti-Bot Protection & Auth Gateway
 *
 * In Next.js 16, the middleware concept has been renamed to "proxy".
 * This file replaces the old middleware.ts pattern.
 *
 * Architecture (optimized for Vercel Free):
 *   Layer 0: Skip non-essential requests (OPTIONS, HEAD, static assets, cdn-cgi)
 *   Layer 1: Block suspicious paths (.env, .git, wp-, phpmyadmin)
 *   Layer 2: JWT verification FIRST for protected routes — reject before any Redis call
 *   Layer 3: Anti-bot protection ONLY for public auth routes (login/register)
 *   Layer 4: Rate limiting & IP blocklist only for authenticated requests to auth routes
 *
 * IMPORTANT: Turnstile verification is NOT done in proxy.
 * Turnstile tokens are single-use — verifying here would cause the
 * route handler's second verification to always fail.
 * Turnstile is handled exclusively in the route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, verifyRefreshToken } from "@/lib/auth";
import {
  getClientIPEdge,
  classifyAuthRoute,
  getAuthRouteLimiter,
  isIPBlocked,
  blockIP,
  getRedis,
} from "@/lib/edge-ratelimit";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Number of rate-limit violations before auto-blocking an IP */
const VIOLATIONS_BEFORE_BLOCK = 5;

/** Progressive block durations (seconds) based on offense severity */
const BLOCK_DURATIONS = [
  5 * 60,   // 1st auto-block: 5 min
  15 * 60,  // 2nd auto-block: 15 min
  30 * 60,  // 3rd auto-block: 30 min
  60 * 60,  // 4th+: 60 min
];

/** Routes that don't require authentication */
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",
  "/login",
  "/api/config",
];

/** Routes that require ADMIN role */
const ADMIN_PATHS = ["/admin", "/api/admin"];

// ─── Paths that should NEVER be rate-limited or blocked ──────────────────────

const ALWAYS_SKIP_PREFIXES = [
  "/_next/",
  "/cdn-cgi/",
  "/static/",
];

const ALWAYS_SKIP_EXACT = new Set([
  "/favicon.ico",
  "/sitemap.xml",
  "/robots.txt",
]);

// ─── Violation Tracking ──────────────────────────────────────────────────────

const VIOLATIONS_PREFIX = "violations:";

async function incrementViolations(ip: string): Promise<number> {
  try {
    const redis = getRedis();
    if (!redis) return 0; // Redis not configured — skip violation tracking
    const key = `${VIOLATIONS_PREFIX}${ip}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    return count;
  } catch {
    return 0;
  }
}

// ─── Edge Logging (minimal, no Node.js APIs) ────────────────────────────────

function edgeLog(level: "info" | "warn" | "error", event: string, data: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" && level === "info") return;
  const prefix = { info: "[PROXY-INFO]", warn: "[PROXY-WARN]", error: "[PROXY-ERROR]" }[level];
  console.log(`${prefix} ${event}`, JSON.stringify({ ts: new Date().toISOString(), level, event, ...data }));
}

// ─── Response Builders ────────────────────────────────────────────────────────

function rateLimitResponse(retryAfter: number, reason: string): NextResponse {
  return NextResponse.json(
    {
      error: `Demasiadas solicitudes. Intenta en ${retryAfter} segundos.`,
      retryAfter,
      reason,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Reason": reason,
        "Cache-Control": "no-store",
      },
    }
  );
}

function blockResponse(reason: string, expiresAt?: number): NextResponse {
  const retryAfter = expiresAt
    ? Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000))
    : 300;
  return NextResponse.json(
    { error: "Acceso bloqueado temporalmente.", retryAfter, reason },
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

// ─── Security Headers ─────────────────────────────────────────────────────────

function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Strict-Transport-Security":
      process.env.NODE_ENV === "production"
        ? "max-age=31536000; includeSubDomains; preload"
        : "max-age=300",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://i.ibb.co https://assets.nflxext.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://challenges.cloudflare.com https://www.netflix.com",
      "frame-src https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ─── JWT Verification (local, no network) ────────────────────────────────────

/**
 * Verify session from cookies using local JWT verification only.
 * Returns null if no valid session — caller should reject immediately.
 * This runs BEFORE any Redis/network call to save Upstash invocations.
 */
async function verifySessionLocally(request: NextRequest) {
  const accessToken = request.cookies.get("access-token")?.value;
  const refreshToken = request.cookies.get("refresh-token")?.value;
  const legacyToken = request.cookies.get("auth-token")?.value;

  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) return payload;
  }
  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken);
    if (payload) return payload;
  }
  if (legacyToken) {
    const payload = await verifyAccessToken(legacyToken);
    if (payload) return payload;
  }
  return null;
}

// ─── Anti-Bot Protection for POST /api/auth/* (ONLY after JWT check) ──────

async function applyAntiBotProtection(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  const ip = getClientIPEdge(request);
  const routeType = classifyAuthRoute(pathname);
  const method = request.method;

  // ── GET requests: only check blocklist, no rate limiting ──
  if (method === "GET") {
    const blockCheck = await isIPBlocked(ip);
    if (blockCheck.blocked) {
      edgeLog("warn", "IP_BLOCKED_GET", { ip, pathname });
      return blockResponse(blockCheck.reason || "IP bloqueada", blockCheck.expiresAt);
    }
    return null;
  }

  // ── POST requests: full protection ──
  edgeLog("info", "AUTH_POST", { ip, routeType, pathname });

  // ── Layer 1: IP Blocklist ──
  const blockCheck = await isIPBlocked(ip);
  if (blockCheck.blocked) {
    edgeLog("warn", "IP_BLOCKED", { ip, reason: blockCheck.reason });
    return blockResponse(blockCheck.reason || "IP bloqueada", blockCheck.expiresAt);
  }

  // ── Layer 2: Route-Specific Rate Limit (login & register only) ──
  if (routeType === "login" || routeType === "register") {
    const routeLimiter = getAuthRouteLimiter(routeType);
    if (!routeLimiter) {
      return null;
    }
    try {
      const routeResult = await routeLimiter.limit(ip);
      if (!routeResult.success) {
        edgeLog("warn", "ROUTE_RATE_LIMITED", { ip, routeType, remaining: routeResult.remaining });

        const violations = await incrementViolations(ip);
        if (violations >= VIOLATIONS_BEFORE_BLOCK) {
          const blockIndex = Math.min(
            violations - VIOLATIONS_BEFORE_BLOCK,
            BLOCK_DURATIONS.length - 1
          );
          const duration = BLOCK_DURATIONS[blockIndex];
          await blockIP(
            ip,
            `Rate limit excedido en ${routeType} (${violations} violaciones)`,
            duration
          );
          edgeLog("error", "IP_AUTO_BLOCKED", { ip, violations, duration });
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
  }

  return null;
}

// ─── Main Proxy Function ─────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Skip OPTIONS/HEAD (CORS preflight, health checks) ──
  if (method === "OPTIONS" || method === "HEAD") {
    return NextResponse.next();
  }

  // ── Skip static assets and internal paths (zero network calls) ──
  if (ALWAYS_SKIP_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (ALWAYS_SKIP_EXACT.has(pathname)) {
    return NextResponse.next();
  }
  if (pathname.match(/\.(svg|png|jpg|jpeg|ico|webp|woff2?|ttf|eot)$/i)) {
    return NextResponse.next();
  }

  // ── Block suspicious paths ──
  const blockedPatterns = [
    /\.(env|git|htaccess|htpasswd|ini|log|sh|sql|bak|config)$/i,
    /\/wp-/,
    /\/xmlrpc\.php/,
    /\/phpmyadmin/,
    /\/\.well-known\/security\.txt/,
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(pathname)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // ── Classify route type ──
  const isAPI = pathname.startsWith("/api/");
  const isProtectedPage = pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/seller");
  const isPublicAPI = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthRoute = pathname.startsWith("/api/auth/");

  // ── Non-API, non-protected pages: just add security headers, done ──
  if (!isAPI && !isProtectedPage) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1: JWT verification FIRST (local, no network calls)
  // Reject unauthenticated/bot requests before any Redis operation.
  // ══════════════════════════════════════════════════════════════════════════
  const needsAuth = !isPublicAPI && (isAPI || isProtectedPage);

  if (needsAuth) {
    const session = await verifySessionLocally(request);

    if (!session) {
      // No valid session → reject immediately. Zero Redis calls made.
      if (isAPI) {
        return NextResponse.json(
          { success: false, error: "No autenticado" },
          { status: 401, headers: getSecurityHeaders() }
        );
      }
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check admin role
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && session.role !== "ADMIN") {
      if (isAPI) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 403, headers: getSecurityHeaders() }
        );
      }
      return NextResponse.redirect(new URL("/", request.url));
    }

    return addSecurityHeaders(NextResponse.next());
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 2: Public auth routes — apply anti-bot (Redis) protection
  // Only reached for login/register/me/logout — all other paths returned above.
  // ══════════════════════════════════════════════════════════════════════════
  if (isAuthRoute) {
    const blocked = await applyAntiBotProtection(request, pathname);
    if (blocked) return blocked;
  }

  return addSecurityHeaders(NextResponse.next());
}

// ─── Matcher Config ──────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|logo\\.svg).*)",
  ],
};