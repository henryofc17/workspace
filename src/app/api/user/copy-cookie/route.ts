
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

    // Buscar varias cookies activas
    const cookies = await prisma.cookie.findMany({
      where: { status: "ACTIVE" },
      orderBy: [
        { usedCount: "asc" },
        { lastUsed: "asc" },
      ],
      take: 5,
    });

    if (!cookies || cookies.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No hay cookies disponibles",
          noCookies: true,
        },
        { status: 503 }
      );
    }

    let selectedCookie: any = null;

    // Intentar varias cookies automáticamente
    for (const cookie of cookies) {
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
        continue;
      }

      const result = await checkCookie(cookieDict);

      // Si funciona, usarla
      if (result.success) {
        selectedCookie = cookie;
        break;
      }

      const errorText = result.error || "";

      // Si sale bloqueo de token, NO matar cookie, solo saltarla
      if (
        errorText.includes("createAutoLoginToken") ||
        errorText.includes("Access denied by SBD")
      ) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: {
            lastError: "Bloqueo temporal token",
            lastUsed: new Date(),
          },
        });
        continue;
      }

      // Otros errores sí la matan
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          status: "DEAD",
          lastError: errorText,
          lastUsed: new Date(),
        },
      });
    }

    // Si ninguna funcionó
    if (!selectedCookie) {
      return NextResponse.json({
        success: false,
        error: "Intentar de nuevo",
      });
    }

    // Cobrar SOLO una vez al final
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: {
          credits: { decrement: COPY_COST },
        },
      }),

      prisma.cookie.update({
        where: { id: selectedCookie.id },
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
          description: `Cookie copiada #${selectedCookie.id.slice(
            0,
            6
          )}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      cookie: selectedCookie.rawCookie,
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
