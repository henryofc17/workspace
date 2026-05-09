import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createTokenPair, setAuthCookies } from "@/lib/auth";
import {
  getClientIP,
  logSecurityEvent,
  SecurityEvents,
} from "@/lib/security";
import { validateBody, loginSchema } from "@/lib/validators";
import { checkIPRisk } from "@/lib/ip-guard";
import {
  isIPBlockedServer,
  loginRatelimit,
  checkRateLimitRedis,
} from "@/lib/ratelimit";
import { verifyTurnstileEdge } from "@/lib/edge-ratelimit";

// ─── Login Handler ────────────────────────────────────────────────────────────
//
// Defense layers:
//   1. Edge middleware: IP blocklist + rate limiting (already applied)
//   2. Route handler: Redis IP blocklist (defense-in-depth)
//   3. Route handler: IP fraud check (fail-open)
//   4. Route handler: Redis rate limiting (defense-in-depth with middleware)
//   5. Route handler: Body validation
//   6. Route handler: Turnstile verification (ONLY here, not in middleware)
//   7. Route handler: Password verification
//
// NOTE: Turnstile is verified ONLY in the route handler.
// The middleware does NOT verify Turnstile — tokens are single-use
// and verifying in both places causes "timeout-or-duplicate" errors.

export async function POST(req: Request) {
  try {
    const clientIP = getClientIP(req as any);

    // ── Layer 1: Redis IP Blocklist check (defense-in-depth with middleware) ──
    const blockCheck = await isIPBlockedServer(clientIP);
    if (blockCheck.blocked) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: { reason: "ip_blocklist", blockReason: blockCheck.reason },
      });
      return NextResponse.json(
        {
          error: "Acceso bloqueado temporalmente.",
          retryAfter: blockCheck.expiresAt
            ? Math.ceil((blockCheck.expiresAt - Date.now()) / 1000)
            : 300,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              blockCheck.expiresAt
                ? Math.ceil((blockCheck.expiresAt - Date.now()) / 1000)
                : 300
            ),
          },
        }
      );
    }

    // ── Layer 2: IP Fraud Check (fail-open — never blocks on API error) ──
    const ipRisk = await checkIPRisk(clientIP);
    if (ipRisk.blocked) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: {
          reason: "ip_risk",
          ipRiskScore: ipRisk.score,
          ipRiskReason: ipRisk.reason,
        },
      });
      return NextResponse.json(
        { error: "No se permite el acceso desde esta red." },
        { status: 403 }
      );
    }

    // ── Layer 3: Redis-based rate limit (defense-in-depth with middleware) ──
    // The middleware already rate-limits, but this adds a second check
    // in case the middleware fails or is bypassed.
    const redisRateCheck = await checkRateLimitRedis(loginRatelimit, clientIP);
    if (!redisRateCheck.allowed) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.RATE_LIMIT_EXCEEDED,
        ip: clientIP,
        details: { reason: "redis_rate_limit", retryAfter: redisRateCheck.retryAfter },
      });
      return NextResponse.json(
        {
          error: `Demasiados intentos. Espera ${redisRateCheck.retryAfter} segundos.`,
          retryAfter: redisRateCheck.retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(redisRateCheck.retryAfter || 300) },
        }
      );
    }

    // ── Layer 4: Parse & validate body ──
    const body = await req.json();
    const validation = validateBody(loginSchema, body);
    if (!validation.success) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.INPUT_VALIDATION_FAILED,
        ip: clientIP,
        details: { field: "login", error: validation.error },
      });
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const { username, password, turnstileToken } = validation.data;

    // ── Layer 5: Turnstile Verification (ONLY here — NOT in middleware) ──
    // Turnstile tokens are single-use. The middleware does NOT verify them.
    const turnstileResult = await verifyTurnstileEdge(
      turnstileToken || "",
      clientIP
    );
    if (!turnstileResult.success) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.SUSPICIOUS_ACTIVITY,
        ip: clientIP,
        details: {
          reason: "turnstile_failed",
          username,
          error: turnstileResult.error,
        },
      });
      return NextResponse.json(
        { error: turnstileResult.error, turnstileFailed: true },
        { status: 403 }
      );
    }

    // ── Layer 6: Find user (case-insensitive) ──
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    if (!user) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.LOGIN_FAILED,
        ip: clientIP,
        details: { username, reason: "user_not_found" },
      });
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // ── Layer 7: Compare password ──
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.LOGIN_FAILED,
        ip: clientIP,
        userId: user.id,
        username: user.username,
        details: { reason: "wrong_password" },
      });
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    // ── Generate token pair ──
    const tokens = await createTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // ── Set cookies & respond ──
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
      },
    });

    setAuthCookies(response, tokens);

    logSecurityEvent({
      level: "info",
      event: SecurityEvents.LOGIN_SUCCESS,
      ip: clientIP,
      userId: user.id,
      username: user.username,
    });

    return response;
  } catch (err) {
    console.error(
      "[LOGIN_ERROR]",
      err instanceof Error ? err.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Error del servidor" },
      { status: 500 }
    );
  }
}
