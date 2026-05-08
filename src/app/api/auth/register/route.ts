import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTokenPair, setAuthCookies } from "@/lib/auth";
import {
  getClientIP,
  logSecurityEvent,
  SecurityEvents,
  checkRateLimit,
  sanitizeString,
} from "@/lib/security";
import { validateBody, registerSchema } from "@/lib/validators";
import { getConfig } from "@/lib/config";
import { checkIPRisk } from "@/lib/ip-guard";

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const clientIP = getClientIP(request as any);

    // ── IP Fraud Check (fail-open — never blocks on API error) ──
    const ipRisk = await checkIPRisk(clientIP);
    if (ipRisk.blocked) {
      return NextResponse.json(
        { success: false, error: "No se permite el registro desde esta red." },
        { status: 403 }
      );
    }

    // ── Rate limit: max 3 registrations per IP per 15 min ──
    const rateCheck = checkRateLimit(`register:${clientIP}`, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000, // 30 min block
    });

    if (!rateCheck.allowed) {
      logSecurityEvent({
        level: "error",
        event: SecurityEvents.REGISTER_BLOCKED,
        ip: clientIP,
        details: { retryAfter: rateCheck.retryAfter },
      });
      return NextResponse.json(
        { success: false, error: `Demasiados registros. Espera ${rateCheck.retryAfter || 60} segundos.` },
        { status: 429 }
      );
    }

    // ── Parse & validate body ──
    const body = await request.json();
    const validation = validateBody(registerSchema, body);
    if (!validation.success) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.INPUT_VALIDATION_FAILED,
        ip: clientIP,
        details: { field: "register", error: validation.error },
      });
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { username, password, fingerprint, turnstileToken } = validation.data;

    const REGISTER_BONUS = await getConfig("REGISTER_BONUS", 3);

    // ── Verify Turnstile ──
    const turnstileValid = await verifyTurnstile(turnstileToken);
    if (!turnstileValid) {
      return NextResponse.json(
        { success: false, error: "Verificación fallida. Intenta de nuevo." },
        { status: 400 }
      );
    }

    // ── Block reserved usernames ──
    const reserved = /^(admin|moderator|root|support|help|netflix|nfchecker|hachejota|staff|system)/i;
    if (reserved.test(username)) {
      return NextResponse.json(
        { success: false, error: "Nombre de usuario no disponible." },
        { status: 400 }
      );
    }

    // ── ANTI-ABUSE: Max 1 account per IP ──
    const ipCount = await prisma.user.count({ where: { ipAddress: clientIP } });
    if (ipCount >= 1) {
      return NextResponse.json(
        { success: false, error: "Solo se permite una cuenta por dispositivo." },
        { status: 429 }
      );
    }

    // ── ANTI-ABUSE: Fingerprint check (now required) ──
    const fpCount = await prisma.user.count({ where: { fingerprint } });
    if (fpCount >= 1) {
      return NextResponse.json(
        { success: false, error: "Ya tienes una cuenta registrada en este navegador." },
        { status: 429 }
      );
    }

    // ── Check username unique ──
    const existing = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ese usuario ya existe" },
        { status: 400 }
      );
    }

    // ── Create user ──
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "USER",
        credits: REGISTER_BONUS,
        ipAddress: clientIP,
        fingerprint: fingerprint || null,
      },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "REGISTER_BONUS",
        credits: REGISTER_BONUS,
        description: "Créditos de bienvenida",
      },
    });

    // ── Generate tokens & respond ──
    const tokens = await createTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
      },
      message: `¡Cuenta creada! Tienes ${REGISTER_BONUS} créditos de bienvenida.`,
    });

    setAuthCookies(response, tokens);

    logSecurityEvent({
      level: "info",
      event: SecurityEvents.REGISTER_SUCCESS,
      ip: clientIP,
      userId: user.id,
      username: user.username,
    });

    return response;
  } catch (err: any) {
    console.error("Register error:", err);
    return NextResponse.json(
      { success: false, error: "Error del servidor. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
