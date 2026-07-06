import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMetadata, extractCookiesFromText, extractCountryFromNetflixId } from "@/lib/netflix-checker";
import { getCountryName } from "@/lib/countries";

// Recheck metadata for ACTIVE cookies missing country or plan.
// Only fetches metadata (no NFToken check needed — they're already validated).
// BATCH_SIZE=4: only 1 HTTP request per cookie (membership page), so 4 concurrent is fine.
const BATCH_SIZE = 4;
const GLOBAL_DEADLINE_MS = 8500;

export async function POST() {
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), GLOBAL_DEADLINE_MS);

  try {
    await requireAdmin();

    // ── 1. Count how many ACTIVE cookies need metadata ──
    const needMetadataCount = await prisma.cookie.count({
      where: {
        status: "ACTIVE",
        OR: [{ country: null }, { plan: null }],
      },
    });

    if (needMetadataCount === 0) {
      clearTimeout(deadlineTimer);
      return NextResponse.json({
        success: true,
        done: true,
        message: "Todas las cookies activas ya tienen país y plan",
        results: { checked: 0, updated: 0, skipped: 0 },
        countries: [],
        total: 0,
        processed: 0,
        remaining: 0,
      });
    }

    // ── 2. Take oldest ACTIVE cookies missing country or plan ──
    const cookies = await prisma.cookie.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ country: null }, { plan: null }],
      },
      orderBy: { lastUsed: "asc" },
      take: BATCH_SIZE,
    });

    // ── 3. Fetch metadata for each cookie ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        const dict = extractCookiesFromText(cookie.rawCookie);
        if (!dict) return { status: "skipped" as const };

        try {
          const meta = await getMetadata(dict, deadline.signal);

          const fallbackCountry = extractCountryFromNetflixId(dict);
          const country = meta.country || fallbackCountry || cookie.country || null;
          const plan = meta.plan || cookie.plan || null;
          const countryName = country ? (meta.countryName || getCountryName(country)) : undefined;

          // Only update if we got something new
          const hasNewData = (country && !cookie.country) || (plan && !cookie.plan);
          if (hasNewData) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: {
                lastUsed: new Date(),
                ...(country && { country }),
                ...(plan && { plan }),
              },
            }).catch(() => {});
          } else {
            // Nothing new found — still update lastUsed to avoid re-picking
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { lastUsed: new Date() },
            }).catch(() => {});
            return { status: "skipped" as const };
          }

          return { status: "updated" as const, country, countryName };
        } catch (err: any) {
          // Timeout or error — don't mark as dead, just skip
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { lastUsed: new Date() },
          }).catch(() => {});
          return { status: "skipped" as const };
        }
      })
    );

    clearTimeout(deadlineTimer);

    // ── 4. Aggregate ──
    let updated = 0;
    let skipped = 0;
    const countriesList: Record<string, { code: string; name: string; count: number }> = {};

    for (const r of results) {
      if (r.status === "updated") {
        updated++;
        if (r.country) {
          if (countriesList[r.country]) {
            countriesList[r.country].count++;
          } else {
            countriesList[r.country] = { code: r.country, name: r.countryName || r.country, count: 1 };
          }
        }
      } else {
        skipped++;
      }
    }

    const countries = Object.values(countriesList).sort((a, b) => b.count - a.count);

    // ── 5. Count remaining ──
    const remainingCount = await prisma.cookie.count({
      where: {
        status: "ACTIVE",
        OR: [{ country: null }, { plan: null }],
      },
    });
    const processedCount = needMetadataCount - remainingCount;
    const done = remainingCount === 0;

    return NextResponse.json({
      success: true,
      done,
      message: done
        ? `Recheck completo: ${updated} actualizadas, ${skipped} sin cambios`
        : `Lote: +${updated} actualizadas, ${skipped} sin cambios`,
      results: { checked: cookies.length, updated, skipped, countriesFound: countries.length },
      countries,
      total: needMetadataCount,
      processed: processedCount,
      remaining: remainingCount,
    });
  } catch (err: any) {
    clearTimeout(deadlineTimer);
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}