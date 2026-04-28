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

/** Extract cookie strings from a .txt file content (one cookie per block separated by blank lines or line-by-line) */
function parseTxtFile(content: string): string[] {
  const cookies: string[] = [];

  // Strategy 1: Try to find individual cookie blocks separated by blank lines
  // Each block may contain multiple lines (Netscape format) or a single line (raw string)
  const blocks = content.split(/\n\s*\n/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Try parsing as a single cookie
    const dict = extractCookiesFromText(trimmed);
    if (dict && Object.keys(dict).length > 0) {
      cookies.push(trimmed);
      continue;
    }

    // If block didn't parse as cookie, try each line individually
    const lines = trimmed.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    for (const line of lines) {
      const lineDict = extractCookiesFromText(line);
      if (lineDict && Object.keys(lineDict).length > 0) {
        cookies.push(line);
      }
    }
  }

  // If no cookies found with block strategy, try line-by-line
  if (cookies.length === 0) {
    const lines = content.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
    for (const line of lines) {
      const dict = extractCookiesFromText(line);
      if (dict && Object.keys(dict).length > 0) {
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
    // Skip directories and hidden files
    if (entry.isDirectory) continue;
    if (entry.entryName.startsWith("__MACOSX")) continue;
    if (entry.entryName.endsWith(".DS_Store")) continue;

    // Only process .txt files
    if (!entry.entryName.endsWith(".txt")) continue;

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
