import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";
import { checkRateLimit } from "@/lib/security";

// ─── Config ──
const KEY_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes
const KEY_PREFIX = "CRED-HJ-";
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function generateCode(): string {
  let code = KEY_PREFIX;
  for (let i = 0; i < 5; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function GET() {
  try {
    const session = await requireAuth();
    await ensureMigrations();

    // Rate limit: max 10 key generations per 30 min
    const rateCheck = checkRateLimit(`gen-key:${session.userId}`, {
      maxRequests: 10,
      windowMs: 30 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Espera ${rateCheck.retryAfter || 30} segundos.` },
        { status: 429 }
      );
    }

    // Generate unique code
    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const exists = await prisma.creditKey.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCode();
    }

    const creditKey = await prisma.creditKey.create({
      data: {
        code,
        userId: session.userId,
        expiresAt: new Date(Date.now() + KEY_EXPIRY_MS),
      },
    });

    return NextResponse.json({ success: true, code: creditKey.code, expiresIn: KEY_EXPIRY_MS / 1000 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("Generate key error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}