import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

// GET /api/admin/cookies — list all cookies with status
//   ?count=duplicates  →  count duplicate NetflixIds
//   ?count=nometa     →  count ACTIVE cookies missing country or plan
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const countType = searchParams.get("count");

    // ── Count duplicates ──
    if (countType === "duplicates") {
      const allCookies = await prisma.cookie.findMany({
        select: { id: true, rawCookie: true },
      });
      const seenIds = new Set<string>();
      let duplicateCount = 0;

      for (const cookie of allCookies) {
        const dict = extractCookiesFromText(cookie.rawCookie);
        const netflixId = dict?.["NetflixId"]?.trim();
        if (!netflixId) continue;
        if (seenIds.has(netflixId)) {
          duplicateCount++;
        } else {
          seenIds.add(netflixId);
        }
      }
      return NextResponse.json({ success: true, duplicateCount });
    }

    // ── Count cookies without metadata ──
    if (countType === "nometa") {
      const count = await prisma.cookie.count({
        where: {
          status: "ACTIVE",
          OR: [{ country: null }, { plan: null }],
        },
      });
      return NextResponse.json({ success: true, noMetaCount: count });
    }

    // ── Default: list cookies with stats ──

    // Count stats from ALL cookies (no limit)
    const [total, active, dead, pending] = await Promise.all([
      prisma.cookie.count(),
      prisma.cookie.count({ where: { status: "ACTIVE" } }),
      prisma.cookie.count({ where: { status: "DEAD" } }),
      prisma.cookie.count({ where: { status: "PENDING" } }),
    ]);

    // List: show most recent 500, but stats are always accurate
    const cookies = await prisma.cookie.findMany({
      orderBy: { lastUsed: "asc" }, // oldest first — admin sees what needs attention
      take: 500,
      select: {
        id: true,
        status: true,
        country: true,
        plan: true,
        usedCount: true,
        lastUsed: true,
        lastError: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      cookies,
      stats: { total, active, dead, pending },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// POST /api/admin/cookies — upload cookies
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const contentType = request.headers.get("content-type") || "";
    let cookieTexts: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const rawText = formData.get("cookies") as string | null;

      if (file) {
        const AdmZip = (await import("adm-zip")).default;
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.name.endsWith(".zip")) {
          try {
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            for (const entry of entries) {
              if (entry.isDirectory || entry.entryName.startsWith("__MACOSX") || entry.entryName.endsWith(".DS_Store")) continue;
              try {
                const content = entry.getData().toString("utf-8");
                const parsed = parseTextToCookies(content);
                cookieTexts.push(...parsed);
              } catch {}
            }
          } catch {
            return NextResponse.json({ success: false, error: "Error al leer el ZIP" }, { status: 400 });
          }
        } else {
          const content = buffer.toString("utf-8");
          const parsed = parseTextToCookies(content);
          cookieTexts.push(...parsed);
        }
      } else if (rawText) {
        const parsed = parseTextToCookies(rawText);
        cookieTexts.push(...parsed);
      }
    } else {
      const body = await request.json();
      const { cookies: bodyCookies } = body;
      if (Array.isArray(bodyCookies)) {
        cookieTexts = bodyCookies;
      } else if (typeof bodyCookies === "string") {
        cookieTexts = parseTextToCookies(bodyCookies);
      }
    }

    // Deduplicate by NetflixId
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const raw of cookieTexts) {
      const dict = extractCookiesFromText(raw);
      if (dict && dict["NetflixId"]) {
        const key = dict["NetflixId"];
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(raw);
        }
      }
    }

    if (unique.length === 0) {
      return NextResponse.json({ success: false, error: "No se encontraron cookies validas" }, { status: 400 });
    }

    const created = await prisma.cookie.createMany({
      data: unique.map((raw) => ({ rawCookie: raw, status: "PENDING" })),
    });

    return NextResponse.json({
      success: true,
      message: `${created.count} cookies subidas correctamente`,
      count: created.count,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// DELETE /api/admin/cookies — delete cookies by type
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "dead") {
      const deleted = await prisma.cookie.deleteMany({ where: { status: "DEAD" } });
      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    if (type === "all") {
      const deleted = await prisma.cookie.deleteMany({});
      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    if (type === "duplicates") {
      // Use extractCookiesFromText for reliable parsing (JSON, Netscape, semicolon formats)
      const allCookies = await prisma.cookie.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, rawCookie: true },
      });
      const seenIds = new Map<string, string>();
      const duplicateIds: string[] = [];

      for (const cookie of allCookies) {
        const dict = extractCookiesFromText(cookie.rawCookie);
        const netflixId = dict?.["NetflixId"]?.trim();
        if (!netflixId) continue;
        if (seenIds.has(netflixId)) {
          duplicateIds.push(cookie.id);
        } else {
          seenIds.set(netflixId, cookie.id);
        }
      }

      if (duplicateIds.length === 0) {
        return NextResponse.json({ success: true, deleted: 0, message: "No se encontraron duplicados" });
      }

      // Delete in chunks of 100 to avoid Prisma query limits
      let totalDeleted = 0;
      for (let i = 0; i < duplicateIds.length; i += 100) {
        const chunk = duplicateIds.slice(i, i + 100);
        const result = await prisma.cookie.deleteMany({ where: { id: { in: chunk } } });
        totalDeleted += result.count;
      }
      return NextResponse.json({ success: true, deleted: totalDeleted, message: `${totalDeleted} cookies duplicadas eliminadas` });
    }

    const cookieId = searchParams.get("id");
    if (cookieId) {
      if (!/^[\w-]+$/.test(cookieId)) {
        return NextResponse.json({ success: false, error: "ID invalido" }, { status: 400 });
      }
      await prisma.cookie.delete({ where: { id: cookieId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Parametro 'type' o 'id' requerido" }, { status: 400 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

function parseTextToCookies(content: string): string[] {
  const results: string[] = [];
  if (!content || !content.trim()) return results;

  const blocks = content.split(/\n\s*\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const dict = extractCookiesFromText(trimmed);
    if (dict && Object.keys(dict).length > 0) {
      results.push(trimmed);
      continue;
    }

    const lines = trimmed.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      const lineDict = extractCookiesFromText(line);
      if (lineDict && Object.keys(lineDict).length > 0) {
        results.push(line);
      }
    }
  }

  return results;
}