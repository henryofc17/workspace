import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";

// ─── In-memory cache with TTL ────────────────────────────────────────────────

interface CacheEntry {
  value: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds

/**
 * Read a numeric config value from the SiteConfig table.
 * Falls back to `defaultValue` if the key doesn't exist or table is missing.
 * Results are cached in-memory for 30 seconds.
 */
export async function getConfig(key: string, defaultValue: number): Promise<number> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    await ensureMigrations();
    const row = await prisma.siteConfig.findUnique({ where: { key } });
    const value = row ? parseInt(row.value, 10) : defaultValue;
    cache.set(key, { value: isNaN(value) ? defaultValue : value, expiresAt: now + TTL_MS });
    return isNaN(value) ? defaultValue : value;
  } catch {
    // If DB is unreachable or table doesn't exist, return default
    return defaultValue;
  }
}

/** Clear all cached config values (call after admin updates) */
export function clearConfigCache(): void {
  cache.clear();
}
