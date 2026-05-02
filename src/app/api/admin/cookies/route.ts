import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

// GET /api/admin/cookies — list all cookies with status
export async function GET() {
  try {
    await requireAdmin();

    const cookies = await prisma.cookie.findMany({
      orderBy: { createdAt: "desc" },
    });

    const active = cookies.filter((c) => c.status === "ACTIVE").length;
    const dead = cookies.filter((c) => c.status === "DEAD").length;

    return NextResponse.json({ success: true, cookies, stats: { total: cookies.length, active, dead } });
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
      return NextResponse.json({ success: false, error: "No se encontraron cookies válidas con NetflixId" }, { status: 400 });
    }

    const created = await prisma.cookie.createMany({
      data: unique.map((raw) => ({ rawCookie: raw, status: "ACTIVE" })),
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
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
      const allCookies = await prisma.cookie.findMany({ orderBy: { createdAt: "asc" } });
      const seenIds = new Map<string, string>();
      const duplicateIds: string[] = [];

      for (const cookie of allCookies) {
        const dict = extractCookiesFromText(cookie.rawCookie);
        const netflixId = dict?.["NetflixId"];
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

      const deleted = await prisma.cookie.deleteMany({ where: { id: { in: duplicateIds } } });
      return NextResponse.json({ success: true, deleted: deleted.count, message: `${deleted.count} cookies duplicadas eliminadas` });
    }

    const cookieId = searchParams.get("id");
    if (cookieId) {
      if (!/^[\w-]+$/.test(cookieId)) {
        return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
      }
      await prisma.cookie.delete({ where: { id: cookieId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Parámetro 'type' o 'id' requerido" }, { status: 400 });
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
