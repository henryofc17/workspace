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

export async function POST(req: Request) {
  try {
    const clientIP = getClientIP(req as any);

    // ── IP Fraud Check (fail-open — never blocks on API error) ──
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

    // ── Rate limit by IP: max 5 attempts per minute ──
    const rateCheck = checkRateLimit(`login:${clientIP}`, {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 min
      blockDurationMs: 15 * 60 * 1000, // 15 min block
    });

    if (!rateCheck.allowed) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.LOGIN_BLOCKED,
        ip: clientIP,
        details: { retryAfter: rateCheck.retryAfter },
      });
      return NextResponse.json(
        {
          error: `Demasiados intentos. Espera ${rateCheck.retryAfter || 15} segundos.`,
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // ── Parse & validate body ──
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

    const { username, password } = validation.data;

    // ── Find user (case-insensitive) ──
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

    // ── Compare password ──
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
    console.error("LOGIN ERROR:", err);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
