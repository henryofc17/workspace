import { prisma } from "@/lib/prisma";

// ─── Auto-Migration: Ensures new tables exist in production ──────────────────
// Called once on cold start or first API access.

let migrated = false;

export async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;

  try {
    // Check if SiteConfig table exists by trying a query
    await prisma.siteConfig.count();
  } catch {
    // Table doesn't exist — create it with raw SQL (works for both PostgreSQL and SQLite)
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SiteConfig" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL
        );
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "SiteConfig_key_key" ON "SiteConfig"("key");`
      );
      console.log("[migrate] SiteConfig table created");
    } catch (err) {
      console.error("[migrate] Failed to create SiteConfig table:", err);
    }
  }

  try {
    // Check if GiftKey table exists
    await prisma.giftKey.count();
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "GiftKey" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "code" TEXT NOT NULL,
          "credits" INTEGER NOT NULL DEFAULT 0,
          "createdBy" TEXT NOT NULL,
          "redeemedBy" TEXT,
          "redeemedAt" DATETIME,
          "createdAt" DATETIME NOT NULL,
          CONSTRAINT "GiftKey_code_key" UNIQUE ("code"),
          CONSTRAINT "GiftKey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "GiftKey_redeemedBy_fkey" FOREIGN KEY ("redeemedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
        );
      `);
      console.log("[migrate] GiftKey table created");
    } catch (err) {
      console.error("[migrate] Failed to create GiftKey table:", err);
    }
  }

  // ── Drop referral columns (PostgreSQL only — graceful if already removed) ──
  try {
    // Check if referralCode column exists
    const colCheck = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'referralCode'
      ) as exists`
    );

    if (colCheck?.[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referredBy_fkey";
        ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referralCode_key";
        ALTER TABLE "User" DROP COLUMN IF EXISTS "referralCode";
        ALTER TABLE "User" DROP COLUMN IF EXISTS "referredBy";
      `);
      console.log("[migrate] Referral columns dropped from User table");
    }
  } catch {
    // Silently ignore — columns may not exist or DB may not support information_schema
  }
}
