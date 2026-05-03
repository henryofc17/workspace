import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { fullCheck } from "@/lib/netflix-checker";
import type { CheckResult } from "@/lib/netflix-checker";
import { prisma } from "@/lib/prisma";

const DAILY_LIMIT = 10;
const RESET_COST = 2; // credits

// Simple in-memory rate limit per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 15;
const RATE_WINDOW = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──
    const session = await requireAuth();
    const userId = session.userId;

    // ── Rate limit by IP ──
    const forwarded = request.headers.get("x-forwarded-for");
    const clientIP = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    const now = Date.now();
    const entry = rateLimit.get(clientIP);
    if (!entry || now > entry.resetAt) {
      rateLimit.set(clientIP, { count: 1, resetAt: now + RATE_WINDOW });
    } else {
      entry.count++;
      if (entry.count > RATE_MAX) {
        return NextResponse.json(
          { success: false, error: "Demasiadas peticiones. Espera un momento." },
          { status: 429 }
        );
      }
    }

    // ── Check daily limit ──
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, checkerUsesToday: true, checkerResetDate: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // Reset counter if day changed (using UTC date comparison)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetDate = new Date(user.checkerResetDate);
    resetDate.setHours(0, 0, 0, 0);

    let usesToday = user.checkerUsesToday;
    if (resetDate.getTime() < today.getTime()) {
      usesToday = 0;
      await prisma.user.update({
        where: { id: userId },
        data: { checkerUsesToday: 0, checkerResetDate: new Date() },
      });
    }

    if (usesToday >= DAILY_LIMIT) {
      return NextResponse.json({
        success: false,
        error: "Has alcanzado tu límite de 10 verificaciones diarias.",
        dailyLimitReached: true,
        usesToday,
        dailyLimit: DAILY_LIMIT,
        resetCost: RESET_COST,
        credits: user.credits,
      });
    }

    // ── Parse body ──
    const body = await request.json();
    const { cookieText } = body;

    if (!cookieText || typeof cookieText !== "string" || !cookieText.trim()) {
      return NextResponse.json(
        { success: false, error: "Se requiere el texto de la cookie" },
        { status: 400 }
      );
    }

    // ── Perform check ──
    const result: CheckResult = await fullCheck(cookieText.trim());

    // ── Only count if cookie is VALID ──
    if (result.success) {
      await prisma.user.update({
        where: { id: userId },
        data: { checkerUsesToday: { increment: 1 } },
      });
      usesToday++;
    }

    return NextResponse.json({
      ...result,
      usesToday,
      dailyLimit: DAILY_LIMIT,
      remainingToday: DAILY_LIMIT - usesToday,
    });
  } catch (err: any) {
    console.error("Check cookie error:", err);
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Sesión expirada. Inicia sesión de nuevo." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: `Error del servidor: ${err.message || "Desconocido"}`,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve current checker usage
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, credits: true, checkerUsesToday: true, checkerResetDate: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    // Reset counter if day changed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const resetDate = new Date(user.checkerResetDate);
    resetDate.setHours(0, 0, 0, 0);

    let usesToday = user.checkerUsesToday;
    if (resetDate.getTime() < today.getTime()) {
      usesToday = 0;
      await prisma.user.update({
        where: { id: userId },
        data: { checkerUsesToday: 0, checkerResetDate: new Date() },
      });
    }

    return NextResponse.json({
      success: true,
      usesToday,
      dailyLimit: DAILY_LIMIT,
      remainingToday: DAILY_LIMIT - usesToday,
      dailyLimitReached: usesToday >= DAILY_LIMIT,
      resetCost: RESET_COST,
      credits: user.credits,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "Sesión expirada." }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
