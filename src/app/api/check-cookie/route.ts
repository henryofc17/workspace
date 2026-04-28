import { NextRequest, NextResponse } from "next/server";
import { fullCheck } from "@/lib/netflix-checker";
import type { CheckResult } from "@/lib/netflix-checker";

export async function POST(request: NextRequest) {
  try {
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
