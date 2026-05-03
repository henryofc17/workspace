import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureMigrations } from "@/lib/migrate";

// ─── Generate random key code: HJFLIX-XXXXX ─────────────────────────────────
function generateKeyCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HJFLIX-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ─── POST: Generate new gift keys ────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    await ensureMigrations();

    const body = await request.json();
    const { count, credits } = body;

    if (!count || !credits || count < 1 || count > 100 || credits < 1) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos. Cantidad: 1-100, Créditos: 1+" },
        { status: 400 }
      );
    }

    const keys: { code: string; credits: number; createdBy: string }[] = [];
    const existingCodes = new Set<string>();

    for (let i = 0; i < count; i++) {
      let code: string;
      let attempts = 0;
      do {
        code = generateKeyCode();
        attempts++;
        if (attempts > 100) break;
      } while (existingCodes.has(code));
      existingCodes.add(code);
      keys.push({ code, credits: Number(credits), createdBy: admin.userId });
    }

    const created = await prisma.giftKey.createMany({ data: keys, skipDuplicates: true });

    return NextResponse.json({
      success: true,
      message: `${created.count} keys generadas`,
      generated: created.count,
    });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("Generate keys error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// ─── GET: List all gift keys ─────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    await requireAdmin();
    await ensureMigrations();

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all"; // all | available | redeemed

    const where: any = {};
    if (filter === "available") where.redeemedBy = null;
    if (filter === "redeemed") where.redeemedBy = { not: null };

    const keys = await prisma.giftKey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        creator: { select: { username: true } },
        redeemer: { select: { username: true } },
      },
    });

    return NextResponse.json({ success: true, keys });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    console.error("List keys error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
