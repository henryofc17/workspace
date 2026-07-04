import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";
import { checkRateLimit } from "@/lib/security";

const FREE_CREDITS = 2;
const DAILY_LIMIT = 5;

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    await ensureMigrations();

    // Rate limit: max 15 redeem attempts per 30 min
    const rateCheck = checkRateLimit(`redeem-free:${session.userId}`, {
      maxRequests: 15,
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
      return NextResponse.json({ success: false, error: "Ingresa el código de la key" }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();

    // ── Daily limit check: count keys redeemed by this user today ──
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await prisma.creditKey.count({
      where: {
        usedBy: session.userId,
        usedAt: { gte: todayStart },
      },
    });

    if (todayCount >= DAILY_LIMIT) {
      return NextResponse.json({
        success: false,
        error: `Has alcanzado el límite máximo de créditos gratis por hoy. Regresa mañana.`,
      }, { status: 429 });
    }

    // ── Atomic: find + validate + credit + mark used ──
    try {
      const result = await prisma.$transaction(async (tx) => {
        const [keyRow] = await tx.$queryRawUnsafe<Array<{
          id: string; code: string; userId: string; used: boolean;
          usedBy: string | null; usedAt: Date | null; expiresAt: Date; createdAt: Date
        }>>(`SELECT * FROM "CreditKey" WHERE "code" = $1 FOR UPDATE`, cleanCode);

        if (!keyRow) {
          return { error: "NOT_FOUND", status: 404 };
        }

        if (keyRow.used) {
          return { error: "ALREADY_USED", status: 400 };
        }

        // Expiry check (15 minutes)
        if (new Date() > new Date(keyRow.expiresAt)) {
          return { error: "EXPIRED", status: 410 };
        }

        // Credit the user
        const updatedUser = await tx.user.update({
          where: { id: session.userId },
          data: { credits: { increment: FREE_CREDITS } },
          select: { credits: true },
        });

        // Mark key as used
        await tx.creditKey.update({
          where: { id: keyRow.id },
          data: {
            used: true,
            usedBy: session.userId,
            usedAt: new Date(),
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId: session.userId,
            type: "FREE_CREDITS",
            credits: FREE_CREDITS,
            description: `Créditos gratis: ${cleanCode}`,
          },
        });

        return {
          success: true,
          credits: FREE_CREDITS,
          totalCredits: updatedUser.credits,
          remainingToday: DAILY_LIMIT - todayCount - 1,
        };
      });

      if (result.error === "NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Key no encontrada" }, { status: 404 });
      }
      if (result.error === "ALREADY_USED") {
        return NextResponse.json({ success: false, error: "Esta key ya fue utilizada" }, { status: 400 });
      }
      if (result.error === "EXPIRED") {
        return NextResponse.json({ success: false, error: "Esta key ha expirado (15 min). Genera una nueva." }, { status: 410 });
      }

      return NextResponse.json({
        success: true,
        message: `¡+${result.credits} créditos! Key ${cleanCode} validada`,
        credits: result.totalCredits,
        remainingToday: result.remainingToday,
      });
    } catch (txErr) {
      return NextResponse.json({ success: false, error: "Error de concurrencia. Intenta de nuevo." }, { status: 409 });
    }
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("Redeem free key error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}