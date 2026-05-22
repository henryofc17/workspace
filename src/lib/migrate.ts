import { prisma } from "@/lib/prisma";

// ─── Auto-Migration: Ensures new tables exist in production ──────────────────
// Called once on cold start or first API access.

let migrated = false;

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HFLIX-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function ensureMigrations(): Promise<void> {
  if (migrated) return;
  migrated = true;

  try {
    // Check if SiteConfig table exists by trying a query
    await prisma.siteConfig.count();
  } catch {
    // Table doesn't exist — create it with raw SQL
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SiteConfig" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "key" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          "updatedAt" TIMESTAMP NOT NULL
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
          "redeemedAt" TIMESTAMP,
          "createdAt" TIMESTAMP NOT NULL,
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

  // ── Ensure referral columns exist on User table ──
  try {
    const colCheck = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'referralCode'
      ) as exists`
    );

    if (!colCheck?.[0]?.exists) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
        ALTER TABLE "User" ADD COLUMN "referredBy" TEXT;
      `);
      console.log("[migrate] Referral columns added to User table");

      // Generate referral codes for existing users who don't have one
      const users = await prisma.user.findMany({ where: { referralCode: null } });
      for (const user of users) {
        let code = generateReferralCode();
        let attempts = 0;
        while (attempts < 10) {
          const exists = await prisma.user.findUnique({ where: { referralCode: code } });
          if (!exists) break;
          code = generateReferralCode();
          attempts++;
        }
        await prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
      }
      console.log(`[migrate] Generated referral codes for ${users.length} existing users`);

      // Add unique constraint on referralCode
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode");`
      );
    }
  } catch (err) {
    console.error("[migrate] Referral migration error:", err);
  }

  // ── Ensure Notification table exists ──
  try {
    await prisma.notification.count();
  } catch {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Notification" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "type" TEXT NOT NULL DEFAULT 'info',
          "active" BOOLEAN NOT NULL DEFAULT true,
          "createdBy" TEXT NOT NULL,
          "createdAt" TIMESTAMP NOT NULL,
          "updatedAt" TIMESTAMP NOT NULL,
          CONSTRAINT "Notification_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
        );
      `);
      console.log("[migrate] Notification table created");

      // Create default welcome notification
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      if (admin) {
        await prisma.notification.create({
          data: {
            title: "¡Bienvenido a Netflix Cookies Vip!",
            message: "Explora la plataforma, verifica cookies gratis y genera tokens. Usa códigos de referido para ganar créditos extra. ¡Disfruta!",
            type: "welcome",
            active: true,
            createdBy: admin.id,
          },
        });
        console.log("[migrate] Default welcome notification created");
      }
    } catch (err) {
      console.error("[migrate] Failed to create Notification table:", err);
    }
  }
}
