import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkCookie,
  extractCookiesFromText,
} from "@/lib/netflix-checker";

const COPY_COST = 3;

export async function POST() {
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
        error: "Intentar de nuevo", // 🔥 SOLO CAMBIO
        cookieDead: true,
        noMoreCookies,
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: {
          credits: { decrement: COPY_COST },
        },
      }),

      prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          usedCount: { increment: 1 },
          lastUsed: new Date(),
        },
      }),

      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "COPY_COOKIE",
          credits: -COPY_COST,
          description: `Cookie copiada #${cookie.id.slice(0, 6)}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      cookie: cookie.rawCookie,
      remainingCredits: user.credits - COPY_COST,
    });
  } catch (err: any) {
    console.error("Copy cookie error:", err);

    return NextResponse.json(
      {
        success: false,
        error: "Error del servidor",
      },
      { status: 500 }
    );
  }
}
