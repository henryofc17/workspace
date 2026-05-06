import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfigString, setConfig } from "@/lib/config";

const AUTO_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOCK_KEY = "AUTO_REFRESH_RUNNING";
const LAST_REFRESH_KEY = "AUTO_REFRESH_LAST";

// GET /api/admin/auto-refresh — returns status + triggers if needed
export async function GET() {
  try {
    await requireAdmin();

    const lastRefresh = await getConfigString(LAST_REFRESH_KEY, "0");
    const isRunning = await getConfigString(LOCK_KEY, "false");
    const lastRefreshNum = Number(lastRefresh) || 0;
    const now = Date.now();
    const elapsed = now - lastRefreshNum;
    const nextRefresh = Math.max(0, AUTO_REFRESH_INTERVAL_MS - elapsed);
    const needsRefresh = elapsed >= AUTO_REFRESH_INTERVAL_MS && isRunning !== "true";

    return NextResponse.json({
      success: true,
      status: {
        lastRefresh: lastRefreshNum > 0 ? new Date(lastRefreshNum).toISOString() : null,
        lastRefreshAgo: Math.floor(elapsed / 1000),
        nextRefreshIn: Math.floor(nextRefresh / 1000),
        isRunning: isRunning === "true",
        needsRefresh,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/admin/auto-refresh — trigger auto-refresh (uses same logic as refresh-cookies)
export async function POST() {
  try {
    await requireAdmin();

    // Check lock to prevent concurrent runs
    const isRunning = await getConfigString(LOCK_KEY, "false");
    if (isRunning === "true") {
      return NextResponse.json({
        success: false,
        error: "Ya hay un refresco automático en ejecución",
      });
    }

    // Check if 24h have passed
    const lastRefresh = await getConfigString(LAST_REFRESH_KEY, "0");
    const lastRefreshNum = Number(lastRefresh) || 0;
    const now = Date.now();
    const elapsed = now - lastRefreshNum;

    // Allow forced refresh (query param force=true) or auto if 24h passed
    const forceRefresh = false; // POST always forces for manual trigger
    if (!forceRefresh && elapsed < AUTO_REFRESH_INTERVAL_MS) {
      return NextResponse.json({
        success: false,
        error: `No han pasado 24 horas. Próximo refresco en ${Math.floor((AUTO_REFRESH_INTERVAL_MS - elapsed) / 1000)}s`,
      });
    }

    // Set lock
    await setConfig(LOCK_KEY, "true");

    // Run refresh in background (fire-and-forget pattern)
    // We use setTimeout to not block the response
    setTimeout(async () => {
      try {
        const { extractCookiesFromText, checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
        const { getCountryName } = await import("@/lib/countries");

        const cookies = await prisma.cookie.findMany({
          where: { status: "ACTIVE" },
        });

        let alive = 0;
        let dead = 0;
        const countriesList: Record<string, { code: string; name: string; count: number }> = {};

        for (const cookie of cookies) {
          const dict = extractCookiesFromText(cookie.rawCookie);
          if (!dict) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: "No se pudo parsear" },
            });
            dead++;
            continue;
          }

          try {
            const result = await checkCookie(dict);

            if (!result.success) {
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { status: "DEAD", lastError: result.error || "Cookie inválida", lastUsed: new Date() },
              });
              dead++;
              continue;
            }

            let country: string | null = null;
            let plan: string | null = null;

            try {
              const metadata = await getMetadata(dict);
              if (metadata.country) {
                country = metadata.country;
                if (countriesList[country]) {
                  countriesList[country].count++;
                } else {
                  countriesList[country] = { code: country, name: metadata.countryName || country, count: 1 };
                }
              }
              if (metadata.plan) plan = metadata.plan;
            } catch {}

            if (!country) {
              const fallbackCountry = extractCountryFromNetflixId(dict);
              if (fallbackCountry) {
                country = fallbackCountry;
                if (countriesList[country]) {
                  countriesList[country].count++;
                } else {
                  countriesList[country] = { code: country, name: getCountryName(country), count: 1 };
                }
              }
            }

            await prisma.cookie.update({
              where: { id: cookie.id },
              data: {
                status: "ACTIVE",
                lastUsed: new Date(),
                ...(country && { country }),
                ...(plan && { plan }),
              },
            });
            alive++;
          } catch (err: any) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: err.message || "Error de conexión" },
            });
            dead++;
          }
        }

        console.log(`[Auto-Refresh] Complete: ${alive} alive, ${dead} dead, ${Object.keys(countriesList).length} regions`);
      } catch (err: any) {
        console.error("[Auto-Refresh] Error:", err.message);
      } finally {
        // Always release lock and update timestamp
        await setConfig(LOCK_KEY, "false");
        await setConfig(LAST_REFRESH_KEY, String(Date.now()));
      }
    }, 0);

    return NextResponse.json({
      success: true,
      message: "Refresco automático iniciado en segundo plano",
    });
  } catch (err: any) {
    // Release lock on error
    await setConfig(LOCK_KEY, "false").catch(() => {});
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
