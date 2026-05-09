import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createTokenPair, setAuthCookies } from "@/lib/auth";
import {
  checkRateLimit,
  getClientIP,
  logSecurityEvent,
  SecurityEvents,
  sanitizeObject,
} from "@/lib/security";
import { validateBody, loginSchema } from "@/lib/validators";
import { checkIPRisk } from "@/lib/ip-guard";
import { isIPBlockedServer, loginRatelimit, checkRateLimitRedis } from "@/lib/ratelimit";

// ─── Turnstile Verification ───────────────────────────────────────────────────

async function verifyTurnstile(token: string, ip: string): Promise<{ success: boolean; error?: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: true }; // Dev mode — skip if no secret

  if (!token || token.length < 10) {
    return { success: false, error: "Token de verificación requerido" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: "Error de verificación" };
    }

    const data = await res.json();

    if (data.success === true) {
      return { success: true };
    }

    const errorCodes: string[] = data["error-codes"] || [];
    const reason = errorCodes.includes("timeout-or-duplicate")
      ? "Verificación expirada, intenta de nuevo"
      : "Verificación fallida";

    return { success: false, error: reason };
  } catch {
    return { success: false, error: "Error de conexión con verificación" };
  }
}

// ─── Login Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const clientIP = getClientIP(req as any);

    // ── Layer 0: Redis IP Blocklist check (defense-in-depth with middleware) ──
    const blockCheck = await isIPBlockedServer(clientIP);
    if (blockCheck.blocked) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: { reason: "ip_blocklist", blockReason: blockCheck.reason },
      });
      return NextResponse.json(
        { error: "Acceso bloqueado temporalmente.", retryAfter: blockCheck.expiresAt ? Math.ceil((blockCheck.expiresAt - Date.now()) / 1000) : 900 },
        { status: 429, headers: { "Retry-After": String(blockCheck.expiresAt ? Math.ceil((blockCheck.expiresAt - Date.now()) / 1000) : 900) } }
      );
    }

    // ── Layer 1: IP Fraud Check (fail-open — never blocks on API error) ──
    const ipRisk = await checkIPRisk(clientIP);
    if (ipRisk.blocked) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: { reason: "ip_risk", ipRiskScore: ipRisk.score, ipRiskReason: ipRisk.reason },
      });
      return NextResponse.json(
        { error: "No se permite el acceso desde esta red." },
        { status: 403 }
      );
    }

    // ── Layer 2: Redis-based rate limit (5 per 10 min, distributed) ──
    const redisRateCheck = await checkRateLimitRedis(loginRatelimit, clientIP);
    if (!redisRateCheck.allowed) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
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
          headers: { "Retry-After": String(redisRateCheck.retryAfter || 600) },
        }
      );
    }

    // ── Layer 3: In-memory rate limit as additional defense ──
    const memRateCheck = checkRateLimit(`login:${clientIP}`, {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 min
      blockDurationMs: 15 * 60 * 1000, // 15 min block
    });

    if (!memRateCheck.allowed) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: { reason: "memory_rate_limit", retryAfter: memRateCheck.retryAfter },
      });
      return NextResponse.json(
        {
          error: `Demasiados intentos. Espera ${memRateCheck.retryAfter || 15} segundos.`,
          retryAfter: memRateCheck.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(memRateCheck.retryAfter || 900) } }
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

    // ── Layer 5: Turnstile Verification ──
    const turnstileResult = await verifyTurnstile(turnstileToken || "", clientIP);
    if (!turnstileResult.success) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.SUSPICIOUS_ACTIVITY,
        ip: clientIP,
        details: { reason: "turnstile_failed", username, error: turnstileResult.error },
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
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
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
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
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
    console.error("[LOGIN_ERROR]", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
