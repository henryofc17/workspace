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

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: Request) {
  try {
    const clientIP = getClientIP(request as any);

    // ── Rate limit: max 3 registrations per IP per 15 min ──
    const rateCheck = checkRateLimit(`register:${clientIP}`, {
      maxRequests: 3,
      windowMs: 15 * 60 * 1000,
      blockDurationMs: 60 * 60 * 1000, // 1 hour block
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

    const { username, password, referralCode, fingerprint, turnstileToken } = validation.data;

    const REGISTER_BONUS = await getConfig("REGISTER_BONUS", 3);
    const REFERRAL_BONUS = await getConfig("REFERRAL_BONUS", 5);

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

    // ── ANTI-ABUSE: Fingerprint check ──
    if (fingerprint) {
      const fpCount = await prisma.user.count({ where: { fingerprint } });
      if (fpCount >= 1) {
        return NextResponse.json(
          { success: false, error: "Ya tienes una cuenta registrada en este navegador." },
          { status: 429 }
        );
      }
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

    // ── Validate referral code ──
    let referrer: { id: string; createdAt: Date; ipAddress: string | null; fingerprint: string | null; username: string } | null = null;
    let referralCodeUsed: string | null = null;

    if (referralCode) {
      const foundReferrer = await prisma.user.findUnique({
        where: { referralCode },
      });

      if (!foundReferrer) {
        return NextResponse.json(
          { success: false, error: "Código de referido inválido" },
          { status: 400 }
        );
      }

      // Referrer must be at least 10 minutes old
      const referrerAge = Date.now() - foundReferrer.createdAt.getTime();
      if (referrerAge < 10 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: "El código de referido es muy reciente." },
          { status: 400 }
        );
      }

      // Cannot be referred by same IP
      if (foundReferrer.ipAddress === clientIP) {
        return NextResponse.json(
          { success: false, error: "No puedes usar tu propio código de referido." },
          { status: 400 }
        );
      }

      // Same fingerprint check
      if (fingerprint && foundReferrer.fingerprint === fingerprint) {
        return NextResponse.json(
          { success: false, error: "No puedes usar tu propio código de referido." },
          { status: 400 }
        );
      }

      // One referral per referrer per IP
      const sameRefSameIP = await prisma.user.count({
        where: { referredBy: referralCode, ipAddress: clientIP },
      });
      if (sameRefSameIP > 0) {
        return NextResponse.json(
          { success: false, error: "Ya existe una cuenta referida por este código en tu red." },
          { status: 400 }
        );
      }

      referrer = foundReferrer;
      referralCodeUsed = referralCode;
    }

    // ── Create user ──
    const hashedPassword = await bcrypt.hash(password, 10);
    let finalCode = generateReferralCode();
    let codeExists = await prisma.user.findUnique({ where: { referralCode: finalCode } });
    while (codeExists) {
      finalCode = generateReferralCode();
      codeExists = await prisma.user.findUnique({ where: { referralCode: finalCode } });
    }

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        passwordPlain: password,
        role: "USER",
        credits: REGISTER_BONUS,
        referralCode: finalCode,
        referredBy: referralCodeUsed,
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

    if (referrer) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: referrer.id },
          data: { credits: { increment: REFERRAL_BONUS } },
        }),
        prisma.transaction.create({
          data: {
            userId: referrer.id,
            type: "REFERRAL_BONUS",
            credits: REFERRAL_BONUS,
            description: `Bonus por referido: ${user.username}`,
          },
        }),
      ]);
    }

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
        referralCode: user.referralCode,
      },
      message: referrer
        ? `¡Cuenta creada! +${REGISTER_BONUS} créditos de bienvenida. Tu referido ganó +${REFERRAL_BONUS} créditos.`
        : `¡Cuenta creada! Tienes ${REGISTER_BONUS} créditos de bienvenida.`,
    });

    setAuthCookies(response, tokens);

    logSecurityEvent({
      level: "info",
      event: SecurityEvents.REGISTER_SUCCESS,
      ip: clientIP,
      userId: user.id,
      username: user.username,
      details: { referredBy: referralCodeUsed || null },
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
