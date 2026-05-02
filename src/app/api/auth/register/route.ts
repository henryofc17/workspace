import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

const REGISTER_BONUS = 3;
const REFERRAL_BONUS = 5;

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

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const { username, password, referralCode, fingerprint, turnstileToken } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Usuario y contraseña requeridos" },
        { status: 400 }
      );
    }

    // Verify turnstile
    if (!turnstileToken) {
      return NextResponse.json(
        { success: false, error: "Completa la verificación" },
        { status: 400 }
      );
    }
    const turnstileValid = await verifyTurnstile(turnstileToken);
    if (!turnstileValid) {
      return NextResponse.json(
        { success: false, error: "Verificación fallida. Intenta de nuevo." },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { success: false, error: "Usuario debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { success: false, error: "Contraseña debe tener al menos 4 caracteres" },
        { status: 400 }
      );
    }

    if (/admin/i.test(username) || /mod/i.test(username)) {
      return NextResponse.json(
        { success: false, error: "Nombre de usuario no permitido" },
        { status: 400 }
      );
    }

    const clientIP = getClientIP(request);

    // ── ANTI-ABUSE: Max 1 account per IP (hardened) ──
    const ipCount = await prisma.user.count({
      where: { ipAddress: clientIP },
    });
    if (ipCount >= 1) {
      return NextResponse.json(
        { success: false, error: "Solo se permite una cuenta por dispositivo. Contacta al admin si necesitas acceso." },
        { status: 429 }
      );
    }

    // ── ANTI-ABUSE: Fingerprint check (same browser = same person) ──
    if (fingerprint) {
      const fpCount = await prisma.user.count({
        where: { fingerprint },
      });
      if (fpCount >= 1) {
        return NextResponse.json(
          { success: false, error: "Ya tienes una cuenta registrada en este navegador." },
          { status: 429 }
        );
      }
    }

    // ── ANTI-ABUSE: Rate limit — max 3 registrations per IP in last 24h ──
    const recentRegs = await prisma.user.count({
      where: {
        ipAddress: clientIP,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentRegs >= 3) {
      return NextResponse.json(
        { success: false, error: "Demasiados registros desde tu red. Intenta ma\u00f1ana." },
        { status: 429 }
      );
    }

    // ── ANTI-ABUSE: Block reserved usernames ──
    const reserved = /^(admin|moderator|root|support|help|netflix|nfchecker|hachejota|staff|system)/i;
    if (reserved.test(username.trim())) {
      return NextResponse.json(
        { success: false, error: "Nombre de usuario no disponible." },
        { status: 400 }
      );
    }

    // ── ANTI-ABUSE: Block disposable email patterns in username ──
    const disposablePattern = /(test|temp|fake|spam|bot|dummy|anon)/i;
    if (disposablePattern.test(username.trim())) {
      return NextResponse.json(
        { success: false, error: "Nombre de usuario no permitido." },
        { status: 400 }
      );
    }

    // ── Check username unique (case-insensitive) ──
    const existing = await prisma.user.findFirst({ where: { username: { equals: username.trim(), mode: 'insensitive' } } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ese usuario ya existe" },
        { status: 400 }
      );
    }

    // ── Validate referral code if provided ──
    let referrer: {
      id: string;
      createdAt: Date;
      ipAddress: string | null;
      fingerprint: string | null;
      username: string;
    } | null = null;
    let referralCodeUsed: string | null = null;

    if (referralCode && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();

      const foundReferrer = await prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!foundReferrer) {
        return NextResponse.json(
          { success: false, error: "Código de referido inválido" },
          { status: 400 }
        );
      }

      // ── ANTI-ABUSE: Referrer account must be at least 10 minutes old ──
      const referrerAge = Date.now() - foundReferrer.createdAt.getTime();
      if (referrerAge < 10 * 60 * 1000) {
        return NextResponse.json(
          { success: false, error: "El código de referido es muy reciente. Espera al menos 10 minutos." },
          { status: 400 }
        );
      }

      // ── ANTI-ABUSE: Cannot be referred by someone with same IP ──
      if (foundReferrer.ipAddress === clientIP) {
        return NextResponse.json(
          { success: false, error: "No puedes usar tu propio código de referido." },
          { status: 400 }
        );
      }

      // ── ANTI-ABUSE: Cannot be referred by someone with same fingerprint ──
      if (fingerprint && foundReferrer.fingerprint === fingerprint) {
        return NextResponse.json(
          { success: false, error: "No puedes usar tu propio código de referido." },
          { status: 400 }
        );
      }

      // ── ANTI-ABUSE: One referral per referrer per IP ──
      const sameRefSameIP = await prisma.user.count({
        where: {
          referredBy: code,
          ipAddress: clientIP,
        },
      });
      if (sameRefSameIP > 0) {
        return NextResponse.json(
          { success: false, error: "Ya existe una cuenta referida por este código en tu red." },
          { status: 400 }
        );
      }

      referrer = foundReferrer;
      referralCodeUsed = code;
    }

    // ── Create user ──
    const hashedPassword = await bcrypt.hash(password, 10);
    let finalCode = generateReferralCode();

    // Ensure referral code is unique
    let codeExists = await prisma.user.findUnique({ where: { referralCode: finalCode } });
    while (codeExists) {
      finalCode = generateReferralCode();
      codeExists = await prisma.user.findUnique({ where: { referralCode: finalCode } });
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        role: "USER",
        credits: REGISTER_BONUS,
        referralCode: finalCode,
        referredBy: referralCodeUsed,
        ipAddress: clientIP,
        fingerprint: fingerprint || null,
      },
    });

    // Create register bonus transaction
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "REGISTER_BONUS",
        credits: REGISTER_BONUS,
        description: "Créditos de bienvenida",
      },
    });

    // Give referral bonus to referrer
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

    // Generate JWT
    const token = await createToken({
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

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
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
