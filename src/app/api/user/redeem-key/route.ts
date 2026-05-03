import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";
import { checkRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureMigrations();

    // ── Rate limit: max 10 redeem attempts per user per hour ──
    const rateCheck = checkRateLimit(`redeem-key:${session.userId}`, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Espera ${rateCheck.retryAfter || 30} segundos.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ success: false, error: "Ingresa un código de key" }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Find the key
    const key = await prisma.giftKey.findUnique({ where: { code: cleanCode } });

    if (!key) {
      return NextResponse.json({ success: false, error: "Key no encontrada" }, { status: 404 });
    }

    if (key.redeemedBy) {
      return NextResponse.json({ success: false, error: "Esta key ya fue canjeada" }, { status: 400 });
    }

    // Credit the user and mark key as redeemed in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { credits: { increment: key.credits } },
      }),
      prisma.giftKey.update({
        where: { id: key.id },
        data: {
          redeemedBy: session.userId,
          redeemedAt: new Date(),
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "GIFT_KEY",
          credits: key.credits,
          description: `Key canjeada: ${cleanCode}`,
        },
      }),
    ]);

    // Get updated user credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { credits: true },
    });

    return NextResponse.json({
      success: true,
      message: `¡+${key.credits} créditos! Key ${cleanCode} canjeada exitosamente`,
      credits: user?.credits || 0,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("Redeem key error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
