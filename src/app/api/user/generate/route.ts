import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import { pickAndValidateCookie } from "@/lib/cookie-picker";
import { getCountryName } from "@/lib/countries";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 401 }
      );
    }

    // Verificar créditos
    const GENERATE_COST = await getConfig("GENERATE_COST", 1);

    if (user.credits < GENERATE_COST) {
      return NextResponse.json(
        {
          success: false,
          error: `Créditos insuficientes. Necesitas ${GENERATE_COST} crédito(s), tienes ${user.credits}`,
        },
        { status: 400 }
      );
    }

    // ── Pick + validate cookie individually (retries automatically on dead cookies) ──
    const picked = await pickAndValidateCookie(user.region);

    if (!picked.success) {
      // Check if there are truly no active cookies left
      const [activeCount, totalCount] = await Promise.all([
        prisma.cookie.count({ where: { status: "ACTIVE" } }),
        prisma.cookie.count(),
      ]);
      const noMoreCookies = totalCount > 0 && activeCount === 0;

      return NextResponse.json(
        {
          success: false,
          error: picked.error,
          noCookies: picked.noCookies,
          noMoreCookies,
        },
        { status: 503 }
      );
    }

    const cookie = picked.cookie;

    // Éxito — atomic credit deduction using transaction with balance check
    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: session.userId, credits: { gte: GENERATE_COST } },
          data: { credits: { decrement: GENERATE_COST } },
        });
        await tx.cookie.update({
          where: { id: cookie.id },
          data: { usedCount: { increment: 1 }, lastUsed: new Date() },
        });
        await tx.transaction.create({
          data: {
            userId: session.userId,
            type: "GENERATE_TOKEN",
            credits: -GENERATE_COST,
            description: `Token generado con cookie #${cookie.id.slice(0, 6)}${picked.regionName ? ` [${picked.regionName}]` : ""}`,
          },
        });
        return u;
      });

      return NextResponse.json({
        success: true,
        token: cookie.tokenResult.token,
        link: cookie.tokenResult.link,
        remainingCredits: updatedUser.credits,
        country: cookie.country || null,
        countryName: cookie.country ? getCountryName(cookie.country) : null,
        plan: cookie.plan || null,
      });
    } catch {
      // Race condition: credits changed between check and deduction
      return NextResponse.json(
        { success: false, error: "Créditos insuficientes. Intenta de nuevo." },
        { status: 400 }
      );
    }
  } catch {
    console.error("Generate token error");
    return NextResponse.json(
      { success: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}