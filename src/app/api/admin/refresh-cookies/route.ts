import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullCheck, extractCountryFromNetflixId } from "@/lib/netflix-checker";
import type { NetflixMetadata } from "@/lib/netflix-checker";
import { getCountryName } from "@/lib/countries";

// No maxDuration — Vercel Free default (10s) applies.
// This is a Micro-Job: each call processes only a small batch.
// Call it repeatedly from the frontend until all cookies are validated.

/** Cookies processed per micro-job invocation */
const BATCH_SIZE = 10;

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const beforeParam = searchParams.get("before");

    // ── Build session where clause ──
    let sessionWhere: any = {};
    if (beforeParam) {
      const beforeDate = new Date(beforeParam);
      if (!isNaN(beforeDate.getTime())) {
        sessionWhere = { lastUsed: { lt: beforeDate } };
      }
    }

    // Count total cookies in scope
    const total = await prisma.cookie.count({ where: sessionWhere });
    const grandTotal = beforeParam ? null : total;

    // ── Micro-Job: take only the oldest BATCH_SIZE cookies ──
    const cookies = await prisma.cookie.findMany({
      where: sessionWhere,
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
        grandTotal: grandTotal || 0,
      });
    }

    // ── Process each cookie using fullCheck (same logic as user validation) ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        try {
          // fullCheck = checkCookie (NFToken GraphQL) + getMetadata (membership page)
          // Same exact flow as /api/check-cookie used by regular users
          const result = await fullCheck(cookie.rawCookie);

          if (!result.success) {
            // Mark as DEAD only if it's a real validation failure (not timeout/connection)
            const errorStr = result.error || "";
            const isTransient = errorStr.includes("TIMEOUT") || errorStr.includes("CONNECTION_ERROR");

            if (isTransient) {
              // Network issue — skip, don't kill the cookie
              return { status: "skipped" as const };
            }

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

          // Cookie is VALID — extract metadata
          const meta = (result.metadata || {}) as NetflixMetadata;
          const fallbackCountry = extractCountryFromNetflixId(
            // Re-extract dict for country fallback
            (() => {
              const pairs = cookie.rawCookie.split(";").map(p => p.trim()).filter(Boolean);
              const d: Record<string, string> = {};
              for (const pair of pairs) {
                const eq = pair.indexOf("=");
                if (eq > 0) d[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
              }
              return d;
            })()
          );

          const country = meta.country || fallbackCountry || null;
          const plan = meta.plan || null;
          const countryName = country ? (meta.countryName || getCountryName(country)) : undefined;

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
          // Unexpected error — don't mark as DEAD
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
      },
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