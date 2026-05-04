import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkCookie,
  extractCookiesFromText,
} from "@/lib/netflix-checker";
import { getConfig } from "@/lib/config";
import { pickCookie } from "@/lib/cookie-picker";
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 401 }
      );
    }

    const COPY_COST = await getConfig("COPY_COST", 3);

    if (user.credits < COPY_COST) {
      return NextResponse.json(
        {
          success: false,
          error: `Créditos insuficientes. Necesitas ${COPY_COST} crédito(s), tienes ${user.credits}`,
        },
        { status: 400 }
      );
    }

    // ── Pick random cookie with region filtering (no fallback) ──
    const picked = await pickCookie(user.region);

    if (!picked.success) {
      return NextResponse.json(
        { success: false, error: picked.error, noCookies: picked.noCookies },
        { status: 503 }
      );
    }

    const cookie = picked.cookie;

    const cookieDict = extractCookiesFromText(cookie.rawCookie);

    if (!cookieDict) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          status: "DEAD",
          lastError: "No se pudo parsear la cookie",
          lastUsed: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        error: "Cookie dañada, intenta de nuevo",
        retry: true,
      });
    }

    const result = await checkCookie(cookieDict);

    if (!result.success) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          status: "DEAD",
          lastError: result.error,
          lastUsed: new Date(),
        },
      });

      const activeCount = await prisma.cookie.count({
        where: { status: "ACTIVE" },
      });

      const totalCount = await prisma.cookie.count();

      const noMoreCookies =
        totalCount > 0 && activeCount === 0;

      return NextResponse.json({
        success: false,
        error: "Intentar de nuevo",
        cookieDead: true,
        noMoreCookies,
      });
    }

    // Atomic credit deduction
    try {
      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: session.userId, credits: { gte: COPY_COST } },
          data: { credits: { decrement: COPY_COST } },
        });
        await tx.cookie.update({
          where: { id: cookie.id },
          data: { usedCount: { increment: 1 }, lastUsed: new Date() },
        });
        await tx.transaction.create({
          data: {
            userId: session.userId,
            type: "COPY_COOKIE",
            credits: -COPY_COST,
            description: `Cookie copiada #${cookie.id.slice(0, 6)}${picked.regionName ? ` [${picked.regionName}]` : ""}`,
          },
        });
        return u;
      });

      return NextResponse.json({
        success: true,
        cookie: cookie.rawCookie,
        remainingCredits: updatedUser.credits,
        country: cookie.country || null,
        countryName: cookie.country ? getCountryName(cookie.country) : null,
        plan: cookie.plan || null,
      });
    } catch {
      return NextResponse.json(
        { success: false, error: "Créditos insuficientes. Intenta de nuevo." },
        { status: 400 }
      );
    }
  } catch {
    console.error("Copy cookie error");
    return NextResponse.json(
      { success: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}
