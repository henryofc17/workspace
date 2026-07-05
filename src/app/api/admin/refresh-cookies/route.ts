import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";
import type { NetflixMetadata } from "@/lib/netflix-checker";

// No maxDuration — Vercel Free default (10s) applies.
// This is a Micro-Job: each call processes only a small batch.
// Call it repeatedly from the frontend until all cookies are validated.

/** Cookies processed per micro-job invocation */
const BATCH_SIZE = 15;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("active") === "true";

    // ── Count TOTAL cookies first (for frontend progress) ──
    const where = onlyActive
      ? { status: "ACTIVE" }
      : {};

    const total = await prisma.cookie.count({ where });

    // ── Micro-Job: take only the oldest BATCH_SIZE cookies ──
    const cookies = await prisma.cookie.findMany({
      where,
      orderBy: { lastUsed: "asc" },
      take: BATCH_SIZE,
    });

    if (cookies.length === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        message: "No hay cookies para validar",
        results: { checked: 0, alive: 0, dead: 0, skipped: 0, countriesFound: 0 },
        countries: [],
        total: 0,
        processed: 0,
        remaining: 0,
      });
    }

    const { checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
    const { getCountryName } = await import("@/lib/countries");

    // ── Process all cookies in parallel with Promise.all ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        const dict = extractCookiesFromText(cookie.rawCookie);

        if (!dict) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "DEAD", lastError: "No se pudo parsear" },
          }).catch(() => {});
          return { status: "dead" as const };
        }

        try {
          const result = await checkCookie(dict);

          if (!result.success) {
            if (result.isTransient) {
              return { status: "skipped" as const };
            }
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: {
                status: "DEAD",
                lastError: result.error || "Cookie invalida",
                lastUsed: new Date(),
              },
            }).catch(() => {});
            return { status: "dead" as const };
          }

          // Extract metadata + country in parallel
          const [metadata, fallbackCountry] = await Promise.all([
            getMetadata(dict).catch(() => ({} as NetflixMetadata)),
            Promise.resolve(extractCountryFromNetflixId(dict)),
          ]);

          const meta = metadata as NetflixMetadata;
          let country = meta.country || fallbackCountry || null;
          let plan = meta.plan || null;
          let countryName: string | undefined;

          if (country) {
            countryName = meta.countryName || getCountryName(country);
          }

          await prisma.cookie.update({
            where: { id: cookie.id },
            data: {
              status: "ACTIVE",
              lastUsed: new Date(),
              ...(country && { country }),
              ...(plan && { plan }),
            },
          }).catch(() => {});

          return {
            status: "alive" as const,
            country,
            countryName,
          };
        } catch {
          // Transient network error — don't mark as DEAD
          return { status: "skipped" as const };
        }
      })
    );

    // ── Aggregate results ──
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
            countriesList[r.country] = {
              code: r.country,
              name: r.countryName || r.country,
              count: 1,
            };
          }
        }
      } else if (r.status === "dead") {
        dead++;
      } else {
        skipped++;
      }
    }

    const countries = Object.values(countriesList).sort((a, b) => b.count - a.count);
    const remaining = total - cookies.length;
    const done = remaining <= 0;

    return NextResponse.json({
      success: true,
      done,
      message: done
        ? `Listo: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`
        : `Lote: +${alive} vivas, +${dead} muertas, +${skipped} saltadas`,
      results: {
        checked: cookies.length,
        alive,
        dead,
        skipped,
        countriesFound: countries.length,
        totalAlive: alive,
        totalDead: dead,
        totalSkipped: skipped,
      },
      countries,
      total,
      processed: cookies.length,
      remaining,
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