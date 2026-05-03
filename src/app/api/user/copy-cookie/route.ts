import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkCookie,
  extractCookiesFromText,
} from "@/lib/netflix-checker";
import { getConfig } from "@/lib/config";
import { checkRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // ── Rate limit per user: max 10 requests per minute ──
    const rateCheck = checkRateLimit(`copy-cookie:${session.userId}`, {
      maxRequests: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiadas peticiones. Espera ${rateCheck.retryAfter || 60} segundos.` },
        { status: 429 }
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

    const cookies = await prisma.cookie.findMany({
      where: { status: "ACTIVE" },
      orderBy: [
        { usedCount: "asc" },
        { lastUsed: "asc" },
      ],
      take: 3,
    });

    if (!cookies || cookies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No hay cookies disponibles. Se ha notificado al administrador.",
          noCookies: true,
        },
        { status: 503 }
      );
    }

    const cookie =
      cookies[Math.floor(Math.random() * cookies.length)];

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
            description: `Cookie copiada #${cookie.id.slice(0, 6)}`,
          },
        });
        return u;
      });

      return NextResponse.json({
        success: true,
        cookie: cookie.rawCookie,
        remainingCredits: updatedUser.credits,
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
