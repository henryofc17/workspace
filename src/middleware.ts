import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { logSecurityEvent, SecurityEvents, getSecurityHeaders, COOKIE_OPTIONS } from "@/lib/security";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/me",  // Returns 401 if no token, which is expected
  "/login",
  "/api/setup",
  "/api/config",  // Public config for pricing display
];

// Routes that require ADMIN role
const ADMIN_PATHS = ["/admin", "/api/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Skip OneSignal SDK routes entirely (no auth, no rate limit, no security checks) ──
  if (
    pathname.includes("OneSignalSDK") ||
    pathname.includes("onesignal") ||
    pathname === "/OneSignalSDKWorker.js" ||
    pathname === "/OneSignalSDK.page.js"
  ) {
    return NextResponse.next();
  }

  // ── Block suspicious paths ──
  const blockedPatterns = [
    /\.(env|git|htaccess|htpasswd|ini|log|sh|sql|bak|config)$/i,
    /\/wp-/,       // WordPress probes
    /\/xmlrpc\.php/, // XML-RPC attacks
    /\/phpmyadmin/,  // phpMyAdmin probes
    /\/\.well-known\/security\.txt/, // info gathering
  ];
  for (const pattern of blockedPatterns) {
    if (pattern.test(pathname)) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.SUSPICIOUS_ACTIVITY,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        details: { path: pathname, reason: "blocked_pattern" },
      });
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: getSecurityHeaders() });
    }
  }

  // ── Skip non-API/non-protected page routes ──
  const isAPI = pathname.startsWith("/api/");
  const isProtectedPage = pathname === "/" || pathname.startsWith("/admin");

  if (!isAPI && !isProtectedPage) {
    // Public pages (login, etc.) - just add security headers
    return addSecurityHeaders(request);
  }

  // ── Allow public API routes ──
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return addSecurityHeaders(request);
  }

  // ── Check authentication for protected routes ──
  const accessToken = request.cookies.get("access-token")?.value;
  const refreshToken = request.cookies.get("refresh-token")?.value;
  // Legacy fallback
  const legacyToken = request.cookies.get("auth-token")?.value;

  let session = null;

  // Try access token
  if (accessToken) {
    session = await verifyAccessToken(accessToken);
  }

  // Try refresh token
  if (!session && refreshToken) {
    session = await verifyAccessToken(refreshToken);
  }

  // Try legacy token (backward compat)
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

    // For API routes, return 401 JSON
    if (isAPI) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // For page routes, redirect to login
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
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|logo\\.svg|OneSignalSDK).*)",
  ],
};
