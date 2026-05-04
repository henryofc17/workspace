import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("active") === "true";

    const where = onlyActive ? { status: "ACTIVE" } : {};
    const cookies = await prisma.cookie.findMany({ where });

    if (cookies.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay cookies para validar",
        results: { checked: 0, alive: 0, dead: 0, countriesFound: 0 },
        countries: [],
      });
    }

    const { checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
    const { getCountryName } = await import("@/lib/countries");
    let alive = 0;
    let dead = 0;
    const countriesSet = new Set<string>();
    const countriesList: Record<string, { code: string; name: string; count: number }> = {};
    let metadataErrors = 0;

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
        // Step 1: Validate cookie can generate token
        const result = await checkCookie(dict);

        if (!result.success) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: {
              status: "DEAD",
              lastError: result.error || "Cookie inválida",
              lastUsed: new Date(),
            },
          });
          dead++;
          continue;
        }

        // Step 2: Extract metadata (country, plan, etc.) from Netflix membership page
        let country: string | null = null;
        let plan: string | null = null;

        try {
          const metadata = await getMetadata(dict);

          if (metadata.country) {
            country = metadata.country;
            countriesSet.add(country);

            // Track country counts
            if (countriesList[country]) {
              countriesList[country].count++;
            } else {
              countriesList[country] = {
                code: country,
                name: metadata.countryName || country,
                count: 1,
              };
            }
          }

          if (metadata.plan) {
            plan = metadata.plan;
          }
        } catch {
          // Metadata extraction failed but cookie is still valid
          metadataErrors++;
        }

        // Step 2b: Fallback — extract country from NetflixId if still unknown
        if (!country) {
          const fallbackCountry = extractCountryFromNetflixId(dict);
          if (fallbackCountry) {
            country = fallbackCountry;
            countriesSet.add(country);
            if (countriesList[country]) {
              countriesList[country].count++;
            } else {
              countriesList[country] = { code: country, name: getCountryName(country), count: 1 };
            }
          }
        }

        // Step 3: Update cookie with ACTIVE status + metadata
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

    // Build sorted countries list
    const countries = Object.values(countriesList).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      message: `Validación completa: ${alive} vivas, ${dead} muertas, ${countries.length} región(es) detectada(s)`,
      results: {
        checked: cookies.length,
        alive,
        dead,
        countriesFound: countries.length,
        metadataErrors,
      },
      countries,
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
