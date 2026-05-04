import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { COUNTRIES, getCountryName } from "@/lib/countries";
import { getConfig } from "@/lib/config";

// ─── GET: Return user's region + available countries (from cookies) ─────────
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

    // Get distinct country codes from active cookies (admin refreshes these)
    const cookieCountries = await prisma.cookie.findMany({
      where: { status: "ACTIVE", country: { not: null } },
      select: { country: true },
      distinct: ["country"],
    });

    const availableCodes = new Set(cookieCountries.map(c => c.country).filter(Boolean) as string[]);
    const availableCountries = COUNTRIES
      .filter(c => availableCodes.has(c.code))
      .map(c => ({ code: c.code, name: c.name }));

    return NextResponse.json({
      success: true,
      region: user?.region || null,
      availableCountries,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// ─── PUT: Set user's region (costs REGION_COST credits) ─────────────────────
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { region } = body;

    // Don't charge if clearing region (setting to null)
    const isClearing = region === null || region === "" || region === undefined;

    if (!isClearing) {
      const validCodes = new Set(COUNTRIES.map(c => c.code));
      const code = String(region).toUpperCase().trim();
      if (!validCodes.has(code)) {
        return NextResponse.json(
          { success: false, error: "Código de país inválido" },
          { status: 400 }
        );
      }
    }

    const regionValue = isClearing ? null : String(region).toUpperCase().trim();

    if (!isClearing) {
      // Check credits
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true, region: true },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 401 });
      }

      // Don't charge if selecting the same region
      if (user.region === regionValue) {
        return NextResponse.json({ success: false, error: "Ya tienes esa región seleccionada" }, { status: 400 });
      }

      const REGION_COST = await getConfig("REGION_COST", 3);

      if (user.credits < REGION_COST) {
        return NextResponse.json(
          { success: false, error: `Créditos insuficientes. Necesitas ${REGION_COST} crédito(s), tienes ${user.credits}` },
          { status: 400 }
        );
      }

      // Atomic: update region + deduct credits
      try {
        const updated = await prisma.$transaction(async (tx) => {
          const u = await tx.user.update({
            where: { id: session.userId, credits: { gte: REGION_COST } },
            data: {
              region: regionValue,
              credits: { decrement: REGION_COST },
            },
            select: { region: true, credits: true },
          });
          await tx.transaction.create({
            data: {
              userId: session.userId,
              type: "CHANGE_REGION",
              credits: -REGION_COST,
              description: `Región cambiada a ${regionValue ? getCountryName(regionValue) : "Todas"} (${regionValue || "Global"})`,
            },
          });
          return u;
        });

        return NextResponse.json({
          success: true,
          region: updated.region,
          remainingCredits: updated.credits,
          message: `Región cambiada a ${regionValue ? getCountryName(regionValue) : "Todas"}`,
        });
      } catch {
        return NextResponse.json(
          { success: false, error: "Créditos insuficientes. Intenta de nuevo." },
          { status: 400 }
        );
      }
    } else {
      // Clearing region — free, no charge
      const updated = await prisma.user.update({
        where: { id: session.userId },
        data: { region: null },
        select: { region: true },
      });

      return NextResponse.json({
        success: true,
        region: null,
        message: "Región eliminada (se usarán todas las cookies)",
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
