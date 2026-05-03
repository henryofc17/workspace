import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  checkCookie,
  extractCookiesFromText,
} from "@/lib/netflix-checker";
import { getConfig } from "@/lib/config";

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

    // ROTACIÓN INTELIGENTE
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

    // Parsear cookie
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

    // Revisar cookie
    const result = await checkCookie(cookieDict);

    // PARSEO DEL ERROR ESPECÍFICO
    if (!result.success) {
      const errorMsg = result.error || "";

      const isNetflixAccessError = errorMsg.includes(
        "DetailedAccessDeniedException"
      ) && errorMsg.includes("createAutoLoginToken");

      await prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          status: "DEAD",
          lastError: errorMsg,
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
        error: isNetflixAccessError
          ? "intenta de nuevo"
          : errorMsg,
        cookieDead: true,
        noMoreCookies,
      });
    }

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
            description: `Token generado con cookie #${cookie.id.slice(0, 6)}`,
          },
        });
        return u;
      });

      return NextResponse.json({
        success: true,
        token: result.token,
        link: result.link,
        remainingCredits: updatedUser.credits,
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
