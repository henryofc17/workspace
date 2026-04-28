import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import {
  extractCookiesFromText,
  checkCookie,
  getMetadata,
} from "@/lib/netflix-checker";
import type { CheckResult, NFTokenResult, NetflixMetadata } from "@/lib/netflix-checker";

interface BatchResult extends CheckResult {
  index: number;
  rawCookie: string;
}

async function processCookie(
  rawCookie: string,
  index: number
): Promise<BatchResult> {
  const cookieDict = extractCookiesFromText(rawCookie);

  if (!cookieDict || Object.keys(cookieDict).length === 0) {
    return {
      index,
      rawCookie,
      success: false,
      error: "No se pudieron extraer cookies",
    };
  }

  const tokenResult: NFTokenResult = await checkCookie(cookieDict);

  if (!tokenResult.success) {
    return {
      index,
      rawCookie,
      success: false,
      error: tokenResult.error || "Error al generar NFToken",
    };
  }

  let metadata: NetflixMetadata = {};
  try {
    metadata = await getMetadata(cookieDict);
  } catch {}

  return {
    index,
    rawCookie,
    success: true,
    token: tokenResult.token,
    link: tokenResult.link,
    metadata,
  };
}

/** Extract cookie strings from a .txt file content */
function parseTxtFile(content: string): string[] {
  const cookies: string[] = [];

  if (!content || !content.trim()) return cookies;

  const blocks = content.split(/\n\s*\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const dict = extractCookiesFromText(trimmed);
    if (dict && Object.keys(dict).length > 0) {
      cookies.push(trimmed);
      continue;
    }

    const lines = trimmed.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    for (const line of lines) {
      const lineDict = extractCookiesFromText(line);
      if (lineDict && Object.keys(lineDict).length > 0) {
        cookies.push(line);
      }
    }
  }

  return cookies;
}

/** Extract cookie strings from a .zip file */
function parseZipFile(buffer: Buffer): string[] {
  const cookies: string[] = [];
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    console.error("Error opening ZIP:", err);
    return cookies;
  }

  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (entry.entryName.startsWith("__MACOSX")) continue;
    if (entry.entryName.endsWith(".DS_Store")) continue;

    try {
      const content = entry.getData().toString("utf-8");
      const fileCookies = parseTxtFile(content);
      cookies.push(...fileCookies);
    } catch (err) {
      console.error(`Error reading ${entry.entryName}:`, err);
    }
  }

  return cookies;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let cookieTexts: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        const cookiesRaw = formData.get("cookies");
        if (cookiesRaw) {
          try {
            const parsed = JSON.parse(cookiesRaw as string);
            cookieTexts = Array.isArray(parsed) ? parsed : [cookiesRaw as string];
          } catch {
            cookieTexts = [cookiesRaw as string];
          }
        } else {
          return NextResponse.json(
            { success: false, error: "No se proporcionó archivo ni cookies" },
            { status: 400 }
          );
        }
      } else {
        const buffer = Buffer.from(await file.arrayBuffer());

        if (file.name.endsWith(".zip")) {
          cookieTexts = parseZipFile(buffer);
        } else {
          const content = buffer.toString("utf-8");
          cookieTexts = parseTxtFile(content);
        }
      }
    } else {
      const body = await request.json();
      const { cookies } = body;

      if (!cookies || !Array.isArray(cookies) || cookies.length === 0) {
        return NextResponse.json(
          { success: false, error: "Se requiere un array de cookies" },
          { status: 400 }
        );
      }

      cookieTexts = cookies;
    }

    if (cookieTexts.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se encontraron cookies válidas en el archivo" },
        { status: 400 }
      );
    }

    if (cookieTexts.length > 50) {
      cookieTexts = cookieTexts.slice(0, 50);
    }

    const results: BatchResult[] = [];
    for (let i = 0; i < cookieTexts.length; i++) {
      const result = await processCookie(cookieTexts[i], i);
      results.push(result);
    }

    const hits = results.filter((r) => r.success).length;
    const fails = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      stats: { total: results.length, hits, fails },
    });
  } catch (err: any) {
    console.error("Batch check error:", err);
    return NextResponse.json(
      { success: false, error: `Error del servidor: ${err.message || "Desconocido"}` },
      { status: 500 }
    );
  }
}
