import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
// adm-zip is heavy (~100KB) — only load when a ZIP file is actually uploaded
import {
  extractCookiesFromText,
  checkCookie,
  getMetadata,
} from "@/lib/netflix-checker";
import type { CheckResult, NFTokenResult, NetflixMetadata } from "@/lib/netflix-checker";
import { checkRateLimit } from "@/lib/security";

// Vercel Free tier: max 10s execution
// No maxDuration export — default 10s applies

// Rate limit: max 3 batch checks per user per 2 minutes
const BATCH_RATE_LIMIT = { maxRequests: 3, windowMs: 2 * 60 * 1000, blockDurationMs: 5 * 60 * 1000 };

/** Maximum cookies per request — keeps execution under Vercel Free 10s limit */
const MAX_COOKIES = 20;

/** Payload size limit: 2 MB */
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/** Process cookies in parallel chunks to maximize throughput without overwhelming Netflix */
const CHUNK_SIZE = 5;

interface BatchResult extends CheckResult {
  index: number;
  rawCookie: string;
}

async function processCookie(
  rawCookie: string,
  index: number
): Promise<BatchResult> {
  const cookieDict = extractCookiesFromText(rawCookie);
  const truncated = typeof rawCookie === 'string' && rawCookie.length > 20
    ? rawCookie.slice(0, 20) + '...'
    : rawCookie;

  if (!cookieDict || Object.keys(cookieDict).length === 0) {
    return {
      index,
      rawCookie: truncated,
      success: false,
      error: "No se pudieron extraer cookies",
    };
  }

  const tokenResult: NFTokenResult = await checkCookie(cookieDict);

  if (!tokenResult.success) {
    return {
      index,
      rawCookie: truncated,
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
    rawCookie: truncated,
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

/** Extract cookie strings from a .zip file — dynamic import to avoid loading adm-zip for non-ZIP requests */
async function parseZipFile(buffer: Buffer): Promise<string[]> {
  const cookies: string[] = [];

  let AdmZip: any;
  try {
    AdmZip = (await import("adm-zip")).default;
  } catch {
    console.error("adm-zip not available");
    return cookies;
  }

  let zip: any;
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
    // ── Reject payloads > 2MB before any processing ──
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { success: false, error: "Payload demasiado grande. Máximo 2 MB." },
        { status: 413 }
      );
    }

    // Auth check
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // ── Rate limit per user ──
    const rateCheck = checkRateLimit(`batch:${session.userId}`, BATCH_RATE_LIMIT);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiadas peticiones. Espera ${rateCheck.retryAfter || 60} segundos.` },
        { status: 429 }
      );
    }

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
          cookieTexts = await parseZipFile(buffer);
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

    // ── Enforce max 20 cookies for Vercel Free 10s limit ──
    if (cookieTexts.length > MAX_COOKIES) {
      cookieTexts = cookieTexts.slice(0, MAX_COOKIES);
    }

    // ── Process in parallel chunks of 5 ──
    const results: BatchResult[] = [];
    for (let i = 0; i < cookieTexts.length; i += CHUNK_SIZE) {
      const chunk = cookieTexts.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map((raw, j) => processCookie(raw, i + j))
      );
      results.push(...chunkResults);
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
      { success: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}