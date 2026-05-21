import { NextRequest, NextResponse } from "next/server";

// ─── CSP Nonce Middleware ─────────────────────────────────────────────────────
// Generates a unique nonce per request and injects it into the CSP header
// so we can remove 'unsafe-inline' and 'unsafe-eval' from script-src.

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64");
}

export function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const isProduction = process.env.NODE_ENV === "production";

  // Build CSP with nonce
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com${!isProduction ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://i.ibb.co https://assets.nflxext.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    `connect-src 'self' https://challenges.cloudflare.com https://www.netflix.com`,
    `frame-src https://challenges.cloudflare.com`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join("; ");

  // Clone response and set headers
  const response = NextResponse.next();

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  response.headers.set(
    "Strict-Transport-Security",
    isProduction
      ? "max-age=31536000; includeSubDomains; preload"
      : "max-age=300"
  );

  // Expose nonce to client-side via a custom header (for dynamic script injection)
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, logo.svg, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|logo\\.svg|robots\\.txt).*)",
  ],
};
