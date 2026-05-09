import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { logSecurityEvent, SecurityEvents, getSecurityHeaders, COOKIE_OPTIONS } from "@/lib/security";
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

/** Routes that don't require authentication */
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me", // Returns 401 if no token, which is expected
  "/login",
  "/api/setup",
  "/api/config", // Public config for pricing display
];

/** Routes that require ADMIN role */
const ADMIN_PATHS = ["/admin", "/api/admin"];

/** Auth routes that require Turnstile verification on POST */
const TURNSTILE_ROUTES = new Set(["login", "register"]);

// ─── Rate-limit violation tracking ────────────────────────────────────────────

const VIOLATIONS_PREFIX = "violations:";

async function incrementViolations(ip: string): Promise<number> {
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    const key = `${VIOLATIONS_PREFIX}${ip}`;
    const count = await redis.incr(key);

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
  if (process.env.NODE_ENV === "production" && level === "info") return;

  const prefix = {
    info: "\x1b[36m[PROXY-INFO]\x1b[0m",
    warn: "\x1b[33m[PROXY-WARN]\x1b[0m",
    error: "\x1b[31m[PROXY-ERROR]\x1b[0m",
  }[level];

  console.log(
    `${prefix} ${event}`,
    JSON.stringify({ ts: new Date().toISOString(), level, event, ...data })
  );
}

// ─── 429 Response Builder ─────────────────────────────────────────────────────

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
    : 900;

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

function turnstileFailResponse(error: string): NextResponse {
  return NextResponse.json(
    { error, turnstileFailed: true },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}

// ─── Anti-Bot Protection for /api/auth/* ──────────────────────────────────────

async function applyAntiBotProtection(
  request: NextRequest,
  pathname: string
): Promise<NextResponse | null> {
  const ip = getClientIPEdge(request);
  const routeType = classifyAuthRoute(pathname);
  const method = request.method;

  edgeLog("info", "AUTH_REQUEST", { ip, routeType, method, pathname });

  // ── Layer 1: IP Blocklist Check ──
  const blockCheck = await isIPBlocked(ip);
  if (blockCheck.blocked) {
    edgeLog("warn", "IP_BLOCKED", {
      ip,
      reason: blockCheck.reason,
      expiresAt: blockCheck.expiresAt,
    });
    return blockResponse(blockCheck.reason || "IP bloqueada", blockCheck.expiresAt);
  }

  // ── Layer 2: Global Auth Rate Limit (20 req/min per IP) ──
  try {
    const globalResult = await authGlobalLimiter.limit(ip);
    if (!globalResult.success) {
      edgeLog("warn", "GLOBAL_RATE_LIMITED", {
        ip,
        routeType,
        remaining: globalResult.remaining,
      });

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
    edgeLog("error", "GLOBAL_LIMITER_ERROR", {
      ip,
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  // ── Layer 3: Route-Specific Rate Limit ──
  const routeLimiter = getAuthRouteLimiter(routeType);

  try {
    const routeResult = await routeLimiter.limit(ip);
    if (!routeResult.success) {
      edgeLog("warn", "ROUTE_RATE_LIMITED", {
        ip,
        routeType,
        remaining: routeResult.remaining,
      });

      const violations = await incrementViolations(ip);
      if (violations >= VIOLATIONS_BEFORE_BLOCK) {
        await blockIP(
          ip,
          `Rate limit excedido en ${routeType}`,
          AUTO_BLOCK_DURATION
        );
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

  // ── Layer 4: Turnstile Verification (login & register POST only) ──
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

        const violations = await incrementViolations(ip);
        if (violations >= VIOLATIONS_BEFORE_BLOCK) {
          await blockIP(ip, "Turnstile fallido repetidamente", AUTO_BLOCK_DURATION);
        }

        return turnstileFailResponse(
          turnstileResult.error || "Verificación fallida"
        );
      }
    } catch {
      edgeLog("warn", "TURNSTILE_PARSE_ERROR", { ip, routeType });
    }
  }

  // No block — pass through
  return null;
}

// ─── Main Proxy Function ──────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.SUSPICIOUS_ACTIVITY,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        details: { path: pathname, reason: "blocked_pattern" },
      });
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: getSecurityHeaders() }
      );
    }
  }

  // ── Anti-Bot Protection for /api/auth/* ──
  if (pathname.startsWith("/api/auth/")) {
    const blocked = await applyAntiBotProtection(request, pathname);
    if (blocked) return blocked;
  }

  // ── Skip non-API/non-protected page routes ──
  const isAPI = pathname.startsWith("/api/");
  const isProtectedPage = pathname === "/" || pathname.startsWith("/admin");

  if (!isAPI && !isProtectedPage) {
    return addSecurityHeaders(request);
  }

  // ── Allow public API routes ──
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return addSecurityHeaders(request);
  }

  // ── Check authentication for protected routes ──
  const accessToken = request.cookies.get("access-token")?.value;
  const refreshToken = request.cookies.get("refresh-token")?.value;
  const legacyToken = request.cookies.get("auth-token")?.value;

  let session = null;

  if (accessToken) {
    session = await verifyAccessToken(accessToken);
  }

  if (!session && refreshToken) {
    session = await verifyAccessToken(refreshToken);
  }

  if (!session && legacyToken) {
    session = await verifyAccessToken(legacyToken);
  }

  if (!session) {
    logSecurityEvent({
      level: "warn",
      event: SecurityEvents.TOKEN_INVALID,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      details: { path: pathname },
    });

    if (isAPI) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ── Check admin role for admin routes ──
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && session.role !== "ADMIN") {
    logSecurityEvent({
      level: "error",
      event: SecurityEvents.UNAUTHORIZED_ACCESS,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userId: session.userId,
      username: session.username,
      details: { path: pathname, attemptedRole: session.role },
    });

    if (isAPI) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 403, headers: getSecurityHeaders() }
      );
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  // ── Log admin access ──
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    logSecurityEvent({
      level: "info",
      event: SecurityEvents.ADMIN_ACCESS,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userId: session.userId,
      username: session.username,
      details: { path: pathname },
    });
  }

  return addSecurityHeaders(request);
}

function addSecurityHeaders(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  const headers = getSecurityHeaders();

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo\\.svg).*)",
  ],
};
