import { prisma } from "@/lib/prisma";
import { getCountryName } from "@/lib/countries";
import {
  checkCookie,
  extractCookiesFromText,
} from "@/lib/netflix-checker";
import type { NFTokenResult } from "@/lib/netflix-checker";

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

// ─── Types for validated pick ───────────────────────────────────────────────

export interface ValidatedCookie {
  id: string;
  rawCookie: string;
  cookieDict: Record<string, string>;
  usedCount: number;
  country: string | null;
  plan: string | null;
  /** Result from checkCookie() — includes token & link for generate */
  tokenResult: NFTokenResult;
}

export interface ValidatedPickResult {
  success: true;
  cookie: ValidatedCookie;
  poolSize: number;
  region: string | null;
  regionName: string | null;
}

export type ValidatedPickOutcome = ValidatedPickResult | CookiePickerError;

// ─── Config ─────────────────────────────────────────────────────────────────

/** Max attempts to find a valid cookie before giving up */
const MAX_VALIDATION_RETRIES = 5;

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

// ─── Pick + Validate (individual verification) ─────────────────────────────

/**
 * Picks a random ACTIVE cookie, validates it individually via checkCookie()
 * against Netflix, and returns it only if the validation succeeds.
 *
 * If the picked cookie is dead/unparseable, it is marked DEAD in the DB
 * and another cookie is tried automatically (up to MAX_VALIDATION_RETRIES).
 *
 * This guarantees the caller always receives a verified, working cookie.
 */
export async function pickAndValidateCookie(
  userRegion: string | null
): Promise<ValidatedPickOutcome> {
  const triedIds = new Set<string>();
  let lastError = "";
  let totalInPool = 0;

  for (let attempt = 0; attempt < MAX_VALIDATION_RETRIES; attempt++) {
    // Build WHERE: ACTIVE + region filter + exclude already-tried IDs
    const whereClause: any = { status: "ACTIVE" };
    if (userRegion) {
      whereClause.country = userRegion;
    }
    if (triedIds.size > 0) {
      whereClause.id = { notIn: Array.from(triedIds) };
    }

    // Count remaining eligible cookies
    const poolSize = await prisma.cookie.count({ where: whereClause });

    if (poolSize === 0) {
      const regionName = userRegion ? getCountryName(userRegion) : null;
      if (triedIds.size > 0) {
        // We tried some cookies but ran out of pool
        return {
          success: false,
          error: userRegion
            ? `No hay cookies válidas en ${regionName} (${userRegion}) después de ${triedIds.size} intentos.`
            : "No hay cookies válidas disponibles. Se intentaron varias y ninguna respondió.",
          noCookies: true,
        };
      }
      return {
        success: false,
        error: userRegion
          ? `No hay cookies disponibles en ${regionName} (${userRegion}).`
          : "No hay cookies disponibles en este momento.",
        noCookies: true,
      };
    }

    totalInPool = poolSize + triedIds.size;

    // Pick a random cookie from remaining pool
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

    if (!cookie) continue;

    triedIds.add(cookie.id);

    // ── Step 1: Parse cookie ──
    const cookieDict = extractCookiesFromText(cookie.rawCookie);

    if (!cookieDict) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: {
          status: "DEAD",
          lastError: "No se pudo parsear la cookie",
        },
      });
      lastError = "Cookie dañada";
      continue; // Try next
    }

    // ── Step 2: Individual validation via Netflix API ──
    const result = await checkCookie(cookieDict);

    if (!result.success) {
      // Only mark DEAD if the error is NOT transient (timeout/connection)
      if (!result.isTransient) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: {
            status: "DEAD",
            lastError: result.error || "Cookie inválida",
            lastUsed: new Date(),
          },
        });
      }
      lastError = result.error || "Cookie inválida";
      continue; // Try next
    }

    // ── Step 3: Cookie validated! Return it with all data ──
    return {
      success: true,
      cookie: {
        id: cookie.id,
        rawCookie: cookie.rawCookie,
        cookieDict,
        usedCount: cookie.usedCount,
        country: cookie.country,
        plan: cookie.plan,
        tokenResult: result,
      },
      poolSize: totalInPool,
      region: userRegion,
      regionName: userRegion ? getCountryName(userRegion) : null,
    };
  }

  // Exhausted all retries
  return {
    success: false,
    error: `No se encontró una cookie válida después de ${triedIds.size} verificaciones. Último error: ${lastError}`,
    noCookies: false,
  };
}