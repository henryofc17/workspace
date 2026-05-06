import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/detect-countries — detect country for cookies that don't have one
export async function POST() {
  try {
    await requireAdmin();

    // Only fetch ACTIVE cookies that don't have a country yet
    const cookies = await prisma.cookie.findMany({
      where: {
        status: "ACTIVE",
        country: null,
      },
    });

    if (cookies.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Todas las cookies activas ya tienen país detectado",
        results: { processed: 0, detected: 0, failed: 0 },
      });
    }

    const { extractCookiesFromText, extractCountryFromNetflixId, getMetadata } = await import("@/lib/netflix-checker");
    const { getCountryName } = await import("@/lib/countries");

    let detected = 0;
    let failed = 0;
    const countries: Record<string, { code: string; name: string; count: number }> = {};

    for (const cookie of cookies) {
      const dict = extractCookiesFromText(cookie.rawCookie);
      if (!dict) {
        failed++;
        continue;
      }

      try {
        let country: string | null = null;

        // Step 1: Fast — extract from NetflixId (local, no HTTP)
        country = extractCountryFromNetflixId(dict);

        // Step 2: Slow — fetch metadata from Netflix if still unknown
        if (!country) {
          try {
            const metadata = await getMetadata(dict);
            if (metadata.country) {
              country = metadata.country;
            }
          } catch {
            // Metadata failed, cookie stays without country
          }
        }

        if (country) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { country },
          });
          detected++;

          if (countries[country]) {
            countries[country].count++;
          } else {
            countries[country] = {
              code: country,
              name: getCountryName(country) || country,
              count: 1,
            };
          }
        }
      } catch {
        failed++;
      }
    }

    const countriesList = Object.values(countries).sort((a, b) => b.count - a.count);

    return NextResponse.json({
      success: true,
      message: detected > 0
        ? `País detectado en ${detected} de ${cookies.length} cookies`
        : `No se pudo detectar país en ninguna de las ${cookies.length} cookies`,
      results: {
        processed: cookies.length,
        detected,
        failed,
        skipped: cookies.length - detected - failed,
      },
      countries: countriesList,
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
