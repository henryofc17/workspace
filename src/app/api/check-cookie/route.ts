import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fullCheck } from "@/lib/netflix-checker";
import type { CheckResult } from "@/lib/netflix-checker";

// Simple in-memory rate limit per IP
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_MAX = 10;
const RATE_WINDOW = 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP
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

    const body = await request.json();
    const { cookieText } = body;

    if (!cookieText || typeof cookieText !== "string" || !cookieText.trim()) {
      return NextResponse.json(
        { success: false, error: "Se requiere el texto de la cookie" },
        { status: 400 }
      );
    }

    const result: CheckResult = await fullCheck(cookieText.trim());

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Check cookie error:", err);
    return NextResponse.json(
      {
        success: false,
        error: `Error del servidor: ${err.message || "Desconocido"}`,
      },
      { status: 500 }
    );
  }
}
