import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRIES } from "@/lib/countries";

// ─── GET: Return user's current region ──────────────────────────────────────
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { region: true },
    });

    return NextResponse.json({
      success: true,
      region: user?.region || null,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// ─── PUT: Set user's region ─────────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { region } = body;

    // Validate region code (must be a valid ISO code or empty/null to clear)
    if (region !== null && region !== "" && region !== undefined) {
      const validCodes = new Set(COUNTRIES.map(c => c.code));
      const code = String(region).toUpperCase().trim();
      if (!validCodes.has(code)) {
        return NextResponse.json(
          { success: false, error: "Código de país inválido" },
          { status: 400 }
        );
      }
    }

    const regionValue = region === null || region === "" || region === undefined
      ? null
      : String(region).toUpperCase().trim();

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { region: regionValue },
      select: { region: true, username: true },
    });

    return NextResponse.json({
      success: true,
      region: user.region,
      message: regionValue ? "Región actualizada" : "Región eliminada (se usarán todas las cookies)",
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
