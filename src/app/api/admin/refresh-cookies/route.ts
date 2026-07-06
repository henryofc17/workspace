import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkCookie, getMetadata, extractCookiesFromText, extractCountryFromNetflixId } from "@/lib/netflix-checker";
import type { NetflixMetadata } from "@/lib/netflix-checker";
import { getCountryName } from "@/lib/countries";

// No maxDuration — Vercel Free default (10s) applies.
// Micro-Job: each call processes a small batch. Frontend polls until done.
// BATCH_SIZE=2: each cookie does 2 HTTP requests (GraphQL + membership page).
// 2 cookies × 2 requests = 4 concurrent requests, fits within 10s Vercel timeout.
const BATCH_SIZE = 2;

// Global deadline: abort all HTTP at 8.5s to leave time for DB writes
const GLOBAL_DEADLINE_MS = 8500;

export async function POST(request: NextRequest) {
  // Global deadline controller — kills all HTTP at 8.5s
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), GLOBAL_DEADLINE_MS);

  try {
    await requireAdmin();

    // ── 1. Count ALL cookies (this is the fixed total for progress) ──
    const allTotal = await prisma.cookie.count({});

    if (allTotal === 0) {
      clearTimeout(deadlineTimer);
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

    // ── 1.5. Fresh-session reset ──
    // If all cookies were recently validated (within 30 min), reset lastUsed
    // so clicking "Validar" always does a complete pass from scratch.
    const sessionWindow = new Date(Date.now() - 30 * 60 * 1000);
    const uncheckedBefore = await prisma.cookie.count({
      where: {
        OR: [
          { lastUsed: null },
          { lastUsed: { lt: sessionWindow } },
        ],
      },
    });
    if (uncheckedBefore === 0) {
      await prisma.cookie.updateMany({ data: { lastUsed: null } });
    }

    // ── 2. Take the cookies with OLDEST lastUsed (least recently validated) ──
    const cookies = await prisma.cookie.findMany({
      orderBy: { lastUsed: "asc" },
      take: BATCH_SIZE,
    });

    // ── 3. Validate each cookie: checkCookie (NFToken) + getMetadata (country/plan) ──
    const results = await Promise.all(
      cookies.map(async (cookie) => {
        const dict = extractCookiesFromText(cookie.rawCookie);
        if (!dict) {
          // Can't even parse cookies — mark as dead
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "DEAD", lastError: "No se pudo parsear la cookie", lastUsed: new Date() },
          }).catch(() => {});
          return { status: "dead" as const };
        }

        try {
          // ── Step 1: Validate via NFToken (GraphQL) ──
          const tokenResult = await checkCookie(dict, deadline.signal);

          if (!tokenResult.success) {
            const errorStr = tokenResult.error || "";
            const isTransient = errorStr.includes("TIMEOUT") || errorStr.includes("CONNECTION_ERROR");

            if (isTransient) {
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { lastUsed: new Date() },
              }).catch(() => {});
              return { status: "skipped" as const };
            }

            // Real validation failure → DEAD
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: errorStr, lastUsed: new Date() },
            }).catch(() => {});
            return { status: "dead" as const };
          }

          // ── Step 2: Fetch metadata (country, plan) from membership page ──
          let meta: NetflixMetadata = {};
          try {
            meta = await getMetadata(dict, deadline.signal);
          } catch {
            // Metadata fetch failed — cookie is alive but we'll use fallback
          }

          // ── Step 3: Extract country & plan ──
          const fallbackCountry = extractCountryFromNetflixId(dict);
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
        } catch (err: any) {
          if (err.name === "AbortError" || deadline.signal.aborted) {
            // Deadline hit — don't kill the cookie, just skip this round
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { lastUsed: new Date() },
            }).catch(() => {});
            return { status: "skipped" as const };
          }
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
    const remainingCount = await prisma.cookie.count({
      where: {
        OR: [
          { lastUsed: null },
          { lastUsed: { lt: sessionWindow } },
        ],
      },
    });
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