import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";

export async function POST() {
  try {
    const session = await requireAuth();
    const userId = session.userId;

    const RESET_COST = await getConfig("CHECKER_RESET_COST", 2);
    const DAILY_LIMIT = await getConfig("CHECKER_DAILY_LIMIT", 10);

    // Atomic: check balance + decrement + reset in a single transaction
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, credits: true, checkerUsesToday: true, checkerResetDate: true },
        });

        if (!user) {
          throw new Error("NOT_FOUND");
        }

        if (user.credits < RESET_COST) {
          throw new Error("INSUFFICIENT_CREDITS");
        }

        const u = await tx.user.update({
          where: { id: userId, credits: { gte: RESET_COST } },
          data: {
            credits: { decrement: RESET_COST },
            checkerUsesToday: 0,
            checkerResetDate: new Date(),
          },
          select: { credits: true },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: "CHECKER_RESET",
            credits: -RESET_COST,
            description: `Reinicio de verificaciones diarias (+${DAILY_LIMIT} usos)`,
          },
        });

        return u;
      });

      return NextResponse.json({
        success: true,
        message: `¡${DAILY_LIMIT} verificaciones diarias reiniciadas! Se descontaron ${RESET_COST} créditos.`,
        remainingCredits: updated.credits,
        usesToday: 0,
        dailyLimit: DAILY_LIMIT,
        remainingToday: DAILY_LIMIT,
      });
    } catch (txErr: any) {
      if (txErr.message === "NOT_FOUND") {
        return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
      }
      if (txErr.message === "INSUFFICIENT_CREDITS") {
        return NextResponse.json({
          success: false,
          error: `Créditos insuficientes. Necesitas ${RESET_COST} créditos para reiniciar tus verificaciones.`,
        }, { status: 400 });
      }
      // Race condition: balance changed
      return NextResponse.json({ success: false, error: "Créditos insuficientes. Intenta de nuevo." }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Checker reset error:", err);
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "Sesión expirada." }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
