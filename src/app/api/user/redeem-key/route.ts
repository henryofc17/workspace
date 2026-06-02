import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";
import { checkRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureMigrations();

    // ── Rate limit: max 10 redeem attempts per user per 30 minutes ──
    const rateCheck = checkRateLimit(`redeem-key:${session.userId}`, {
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

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ success: false, error: "Ingresa un código de key" }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // Atomic: find + validate + credit + mark redeemed in a single transaction
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Use raw query with FOR UPDATE to lock the row and prevent race conditions
        const [keyRow] = await tx.$queryRawUnsafe<Array<{id: string, code: string, credits: number, createdBy: string, redeemedBy: string | null, redeemedAt: Date | null, createdAt: Date}>>(
          `SELECT * FROM "GiftKey" WHERE "code" = $1 FOR UPDATE`,
          cleanCode
        );

        if (!keyRow) {
          return { error: "NOT_FOUND", status: 404 };
        }

        if (keyRow.redeemedBy) {
          return { error: "ALREADY_REDEEMED", status: 400 };
        }

        // Credit the user
        const updatedUser = await tx.user.update({
          where: { id: session.userId },
          data: { credits: { increment: keyRow.credits } },
          select: { credits: true },
        });

        // Mark key as redeemed
        await tx.giftKey.update({
          where: { id: keyRow.id },
          data: {
            redeemedBy: session.userId,
            redeemedAt: new Date(),
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: session.userId,
            type: "GIFT_KEY",
            credits: keyRow.credits,
            description: `Key canjeada: ${cleanCode}`,
          },
        });

        return { success: true, credits: keyRow.credits, totalCredits: updatedUser.credits };
      });

      if (result.error === "NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Key no encontrada" }, { status: 404 });
      }
      if (result.error === "ALREADY_REDEEMED") {
        return NextResponse.json({ success: false, error: "Esta key ya fue canjeada" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `¡+${result.credits} créditos! Key ${cleanCode} canjeada exitosamente`,
        credits: result.totalCredits,
      });
    } catch (txErr) {
      // Transaction conflict — another request won the race
      return NextResponse.json({ success: false, error: "Esta key ya fue canjeada. Intenta de nuevo." }, { status: 409 });
    }
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("Redeem key error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
