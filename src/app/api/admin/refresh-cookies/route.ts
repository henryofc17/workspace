import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullCheck, extractCookiesFromText, extractCountryFromNetflixId } from "@/lib/netflix-checker";
import type { NetflixMetadata } from "@/lib/netflix-checker";
import { getCountryName } from "@/lib/countries";

// No maxDuration — Vercel Free default (10s) applies.
// Micro-Job: each call processes a small batch. Frontend polls until done.

/** Cookies per batch — fullCheck does 2 HTTP requests each, keep it small */
const BATCH_SIZE = 5;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const beforeParam = searchParams.get("before");

    // ── Session scope: only cookies with lastUsed < before ──
    let sessionWhere: any = {};
    if (beforeParam) {
      const beforeDate = new Date(beforeParam);
      if (!isNaN(beforeDate.getTime())) {
        sessionWhere = { lastUsed: { lt: beforeDate } };
      }
    }

    // Count cookies still in scope
    const total = await prisma.cookie.count({ where: sessionWhere });
    const grandTotal = beforeParam ? null : total;

    if (total === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        message: "No hay cookies para validar",
        results: { checked: 0, alive: 0, dead: 0, skipped: 0, countriesFound: 0 },
        countries: [],
        total: 0,
        processed: 0,
        remaining: 0,
        grandTotal: grandTotal || 0,
      });
    }

    // ── Take oldest BATCH_SIZE cookies ──
    const cookies = await prisma.cookie.findMany({
      where: sessionWhere,
      orderBy: { lastUsed: "asc" },
      take: BATCH_SIZE,
    });

    // ── Validate each cookie using fullCheck (same as /api/check-cookie) ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        try {
          const result = await fullCheck(cookie.rawCookie);

          if (!result.success) {
            const errorStr = result.error || "";
            const isTransient = errorStr.includes("TIMEOUT") || errorStr.includes("CONNECTION_ERROR");

            if (isTransient) {
              // Network issue — mark as attempted so it doesn't loop forever
              // but DON'T mark as DEAD
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { lastUsed: new Date() },
              }).catch(() => {});
              return { status: "skipped" as const };
            }

            // Real validation failure — cookie is dead
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

          // VALID cookie — extract country & plan from metadata
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
          // Unexpected error — mark attempted to prevent infinite loop
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { lastUsed: new Date() },
          }).catch(() => {});
          return { status: "skipped" as const };
        }
      })
    );

    // ── Aggregate ──
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
    const remaining = total - cookies.length;
    const done = remaining <= 0;

    return NextResponse.json({
      success: true,
      done,
      message: done
        ? `Validacion completa: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`
        : `Lote: +${alive} vivas, +${dead} muertas, +${skipped} saltadas`,
      results: { checked: cookies.length, alive, dead, skipped, countriesFound: countries.length },
      countries,
      total,
      processed: cookies.length,
      remaining,
      grandTotal: grandTotal || undefined,
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