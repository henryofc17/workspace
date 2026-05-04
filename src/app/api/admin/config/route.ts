import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfig, getConfigString, clearConfigCache } from "@/lib/config";
import { ensureMigrations } from "@/lib/migrate";

// ─── GET: Return all config values ───────────────────────────────────────────
export async function GET() {
  try {
    await requireAdmin();

    const numKeys = [
      { key: "GENERATE_COST", defaultValue: 1 },
      { key: "COPY_COST", defaultValue: 3 },
      { key: "TV_ACTIVATE_COST", defaultValue: 5 },
      { key: "CHECKER_DAILY_LIMIT", defaultValue: 10 },
      { key: "CHECKER_RESET_COST", defaultValue: 2 },
      { key: "REGISTER_BONUS", defaultValue: 3 },
      { key: "REFERRAL_BONUS", defaultValue: 5 },
      { key: "REDEEM_BONUS", defaultValue: 3 },
    ];

    const stringKeys = [
      { key: "WHATSAPP_LINK", defaultValue: "" },
      { key: "WHATSAPP_VISIBLE", defaultValue: "false" },
    ];

    const result: Record<string, string | number> = {};
    for (const { key, defaultValue } of numKeys) {
      result[key] = await getConfig(key, defaultValue);
    }
    for (const { key, defaultValue } of stringKeys) {
      result[key] = await getConfigString(key, defaultValue);
    }

    return NextResponse.json({ success: true, config: result });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// ─── PUT: Upsert config values ───────────────────────────────────────────────
export async function PUT(request: Request) {
  try {
    await requireAdmin();
    await ensureMigrations();

    const body = await request.json();
    const updates = body.config;

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ success: false, error: "Config inválida" }, { status: 400 });
    }

    const allowedNumKeys = new Set([
      "GENERATE_COST",
      "COPY_COST",
      "TV_ACTIVATE_COST",
      "CHECKER_DAILY_LIMIT",
      "CHECKER_RESET_COST",
      "REGISTER_BONUS",
      "REFERRAL_BONUS",
      "REDEEM_BONUS",
    ]);

    const allowedStringKeys = new Set([
      "WHATSAPP_LINK",
      "WHATSAPP_VISIBLE",
    ]);

    const ops = [];
    for (const [key, value] of Object.entries(updates)) {
      if (allowedNumKeys.has(key)) {
        const numVal = Number(value);
        if (isNaN(numVal) || numVal < 0) continue;
        ops.push(
          prisma.siteConfig.upsert({
            where: { key },
            update: { value: String(numVal) },
            create: { key, value: String(numVal) },
          })
        );
      } else if (allowedStringKeys.has(key)) {
        const strVal = String(value ?? "").trim();
        if (!strVal) continue;
        ops.push(
          prisma.siteConfig.upsert({
            where: { key },
            update: { value: strVal },
            create: { key, value: strVal },
          })
        );
      }
    }

    if (ops.length > 0) {
      await prisma.$transaction(ops);
      clearConfigCache();
    }

    return NextResponse.json({ success: true, message: "Configuración guardada" });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
