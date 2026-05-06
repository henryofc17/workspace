import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";

// ─── In-memory cache with TTL ────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 5_000; // 5 seconds

/**
 * Read a numeric config value from the SiteConfig table.
 * Falls back to `defaultValue` if the key doesn't exist or table is missing.
 * Results are cached in-memory for 30 seconds.
 */
export async function getConfig(key: string, defaultValue: number): Promise<number> {
  const raw = await getConfigString(key, String(defaultValue));
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Read a string config value from the SiteConfig table.
 * Falls back to `defaultValue` if the key doesn't exist or table is missing.
 * Results are cached in-memory for 30 seconds.
 */
export async function getConfigString(key: string, defaultValue: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    await ensureMigrations();
    const row = await prisma.siteConfig.findUnique({ where: { key } });
    const value = row ? row.value : defaultValue;
    cache.set(key, { value, expiresAt: now + TTL_MS });
    return value;
  } catch {
    // If DB is unreachable or table doesn't exist, return default
    return defaultValue;
  }
}

/**
 * Set (upsert) a config value in the SiteConfig table and update cache.
 */
export async function setConfig(key: string, value: string): Promise<void> {
  try {
    await ensureMigrations();
    await prisma.siteConfig.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: { key, value },
    });
    cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  } catch {
    // Silently fail — config persistence is non-critical
  }
}

/** Clear all cached config values (call after admin updates) */
export function clearConfigCache(): void {
  cache.clear();
}
