import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const RESET_COST = 2;
const DAILY_LIMIT = 10;

export async function POST() {
  try {
    const session = await requireAuth();
    const userId = session.userId;

    // Fetch user with lock-like pattern
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, checkerUsesToday: true, checkerResetDate: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.credits < RESET_COST) {
      return NextResponse.json({
        success: false,
        error: `Créditos insuficientes. Necesitas ${RESET_COST} créditos para reiniciar tus verificaciones.`,
        requiredCredits: RESET_COST,
        currentCredits: user.credits,
      });
    }

    // Deduct credits and reset checker uses
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        credits: { decrement: RESET_COST },
        checkerUsesToday: 0,
        checkerResetDate: new Date(),
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        userId,
        type: "CHECKER_RESET",
        credits: -RESET_COST,
        description: `Reinicio de verificaciones diarias (+${DAILY_LIMIT} usos)`,
      },
    });

    return NextResponse.json({
      success: true,
      message: `¡${DAILY_LIMIT} verificaciones diarias reiniciadas! Se descontaron ${RESET_COST} créditos.`,
      remainingCredits: updated.credits,
      usesToday: 0,
      dailyLimit: DAILY_LIMIT,
      remainingToday: DAILY_LIMIT,
    });
  } catch (err: any) {
    console.error("Checker reset error:", err);
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "Sesión expirada." }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
