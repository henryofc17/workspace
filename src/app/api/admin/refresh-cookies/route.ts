import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullCheck, extractCookiesFromText, extractCountryFromNetflixId } from "@/lib/netflix-checker";
import type { NetflixMetadata } from "@/lib/netflix-checker";
import { getCountryName } from "@/lib/countries";

// No maxDuration — Vercel Free default (10s) applies.
// Micro-Job: each call processes a small batch. Frontend polls until done.

const BATCH_SIZE = 5;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    // ── 1. Count ALL cookies (this is the fixed total for progress) ──
    const allTotal = await prisma.cookie.count({});

    if (allTotal === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        message: "No hay cookies para validar",
        results: { checked: 0, alive: 0, dead: 0, skipped: 0 },
        countries: [],
        total: 0,
        processed: 0,
        remaining: 0,
      });
    }

    // ── 2. Take the 5 cookies with OLDEST lastUsed (least recently validated) ──
    const cookies = await prisma.cookie.findMany({
      orderBy: { lastUsed: "asc" },
      take: BATCH_SIZE,
    });

    // ── 3. Validate each cookie using fullCheck (same as user checker) ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        try {
          const result = await fullCheck(cookie.rawCookie);

          if (!result.success) {
            const errorStr = result.error || "";
            const isTransient = errorStr.includes("TIMEOUT") || errorStr.includes("CONNECTION_ERROR");

            if (isTransient) {
              // Network issue — update lastUsed to avoid re-picking, but don't kill
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { lastUsed: new Date() },
              }).catch(() => {});
              return { status: "skipped" as const };
            }

            // Real validation failure
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: {
                status: "DEAD",
                lastError: errorStr,
                lastUsed: new Date(),
              },
            }).catch(() => {});
            return { status: "dead" as const };
          }

          // VALID — extract country & plan
          const meta = (result.metadata || {}) as NetflixMetadata;
          const dict = extractCookiesFromText(cookie.rawCookie);
          const fallbackCountry = dict ? extractCountryFromNetflixId(dict) : null;

          const country = meta.country || fallbackCountry || null;
          const plan = meta.plan || null;
          const countryName = country ? (meta.countryName || getCountryName(country)) : undefined;

          await prisma.cookie.update({
            where: { id: cookie.id },
            data: {
              status: "ACTIVE",
              lastUsed: new Date(),
              lastError: null,
              ...(country && { country }),
              ...(plan && { plan }),
            },
          }).catch(() => {});

          return { status: "alive" as const, country, countryName };
        } catch {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { lastUsed: new Date() },
          }).catch(() => {});
          return { status: "skipped" as const };
        }
      })
    );

    // ── 4. Aggregate ──
    let alive = 0;
    let dead = 0;
    let skipped = 0;
    const countriesList: Record<string, { code: string; name: string; count: number }> = {};

    for (const r of results) {
      if (r.status === "alive") {
        alive++;
        if (r.country) {
          if (countriesList[r.country]) {
            countriesList[r.country].count++;
          } else {
            countriesList[r.country] = { code: r.country, name: r.countryName || r.country, count: 1 };
          }
        }
      } else if (r.status === "dead") {
        dead++;
      } else {
        skipped++;
      }
    }

    const countries = Object.values(countriesList).sort((a, b) => b.count - a.count);

    // ── 5. Count how many cookies still need processing in this session ──
    // Include cookies with NULL lastUsed (never validated) AND cookies with old lastUsed.
    // Prisma { lt: date } does NOT match null values, so we need an explicit OR.
    const sessionWindow = new Date(Date.now() - 30 * 60 * 1000);
    const remainingCount = await prisma.cookie.count({
      where: {
        OR: [
          { lastUsed: null },
          { lastUsed: { lt: sessionWindow } },
        ],
      },
    });
    // processedCount = cookies that were updated in this session (lastUsed >= sessionWindow)
    const processedCount = allTotal - remainingCount;
    const done = remainingCount === 0;

    return NextResponse.json({
      success: true,
      done,
      message: done
        ? `Validacion completa: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`
        : `Lote: +${alive} vivas, +${dead} muertas, +${skipped} saltadas`,
      results: { checked: cookies.length, alive, dead, skipped, countriesFound: countries.length },
      countries,
      total: allTotal,
      processed: processedCount,
      remaining: remainingCount,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}