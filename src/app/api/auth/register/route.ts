import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";

const REGISTER_BONUS = 3;
const REFERRAL_BONUS = 5;

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
    const { username, password, referralCode, fingerprint } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "Usuario y contraseña requeridos" },
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

    // ── ANTI-ABUSE: Max 2 accounts per IP ──
    const ipCount = await prisma.user.count({
      where: { ipAddress: clientIP },
    });
    if (ipCount >= 2) {
      return NextResponse.json(
        { success: false, error: "Límite de cuentas por dispositivo alcanzado." },
        { status: 400 }
      );
    }

    // ── ANTI-ABUSE: Fingerprint ──
    if (fingerprint) {
      const fpCount = await prisma.user.count({
        where: { fingerprint },
      });
      if (fpCount >= 2) {
        return NextResponse.json(
          { success: false, error: "Ya tienes cuentas en este navegador." },
          { status: 400 }
        );
      }
    }

    // ── Check username ──
    const existing = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ese usuario ya existe" },
        { status: 400 }
      );
    }

    // ── Referral ──
    let referrer = null;

    if (referralCode && referralCode.trim()) {
      const code = referralCode.trim().toUpperCase();

      referrer = await prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!referrer) {
        return NextResponse.json(
          { success: false, error: "Código inválido" },
          { status: 400 }
        );
      }

      // Anti abuse
      const sameRefSameIP = await prisma.user.count({
        where: {
          referredById: referrer.id,
          ipAddress: clientIP,
        },
      });

      if (sameRefSameIP > 0) {
        return NextResponse.json(
          { success: false, error: "Ya usaste este referido" },
          { status: 400 }
        );
      }
    }

    // ── Create user ──
    const hashedPassword = await bcrypt.hash(password, 10);

    let finalCode = generateReferralCode();
    let existsCode = await prisma.user.findUnique({
      where: { referralCode: finalCode },
    });

    while (existsCode) {
      finalCode = generateReferralCode();
      existsCode = await prisma.user.findUnique({
        where: { referralCode: finalCode },
      });
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim().toLowerCase(),
        password: hashedPassword,
        role: "USER",
        credits: REGISTER_BONUS,
        referralCode: finalCode,
        referredById: referrer ? referrer.id : null, // ✅ FIX
        ipAddress: clientIP,
        fingerprint: fingerprint || null,
      },
    });

    // ── Bonus registro ──
    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "REGISTER_BONUS",
        credits: REGISTER_BONUS,
        description: "Bienvenida",
      },
    });

    // ── Bonus referido ──
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
            description: `Referido: ${user.username}`,
          },
        }),
      ]);
    }

    // ── Token ──
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
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { success: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}
