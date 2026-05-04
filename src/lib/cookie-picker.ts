import { prisma } from "@/lib/prisma";
import { getCountryName } from "@/lib/countries";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PickedCookie {
  id: string;
  rawCookie: string;
  usedCount: number;
  country: string | null;
  plan: string | null;
}

export interface CookiePickerResult {
  success: true;
  cookie: PickedCookie;
  poolSize: number;
  region: string | null;
  regionName: string | null;
}

export interface CookiePickerError {
  success: false;
  error: string;
  noCookies: boolean;
}

export type CookiePickerOutcome = CookiePickerResult | CookiePickerError;

// ─── Pick a random cookie with region filtering ─────────────────────────────

/**
 * Selects a random ACTIVE cookie, optionally filtered by user's region.
 *
 * Rules:
 *  - If user has a region set → ONLY cookies matching that country are used.
 *  - If no cookies found for the region → ERROR (no fallback to other regions).
 *  - If user has NO region → ALL active cookies are eligible.
 *  - Selection is truly random from the full eligible pool (not just top-3).
 *  - The returned cookie includes its DB fields for direct use.
 */
export async function pickCookie(
  userRegion: string | null
): Promise<CookiePickerOutcome> {
  // Build WHERE clause: always ACTIVE, optionally filtered by country
  const whereClause: any = { status: "ACTIVE" };
  if (userRegion) {
    whereClause.country = userRegion;
  }

  // Count eligible cookies first (lightweight query)
  const poolSize = await prisma.cookie.count({
    where: whereClause,
  });

  if (poolSize === 0) {
    const regionName = userRegion ? getCountryName(userRegion) : null;
    if (userRegion) {
      return {
        success: false,
        error: `No hay cookies disponibles en ${regionName} (${userRegion}).`,
        noCookies: true,
      };
    }
    return {
      success: false,
      error: "No hay cookies disponibles en este momento.",
      noCookies: true,
    };
  }

  // Skip a random number of rows to pick one truly random cookie from the full pool.
  // This is more efficient than loading all cookies into memory.
  const skip = Math.floor(Math.random() * poolSize);

  const cookie = await prisma.cookie.findFirst({
    where: whereClause,
    skip,
    select: {
      id: true,
      rawCookie: true,
      usedCount: true,
      country: true,
      plan: true,
    },
  });

  if (!cookie) {
    // This should not happen since we verified poolSize > 0, but just in case
    const regionName = userRegion ? getCountryName(userRegion) : null;
    return {
      success: false,
      error: userRegion
        ? `No hay cookies disponibles en ${regionName} (${userRegion}).`
        : "No hay cookies disponibles en este momento.",
      noCookies: true,
    };
  }

  return {
    success: true,
    cookie,
    poolSize,
    region: userRegion,
    regionName: userRegion ? getCountryName(userRegion) : null,
  };
}
