import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody, tvActivateSchema } from "@/lib/validators";
import { getConfig } from "@/lib/config";
import { checkRateLimit } from "@/lib/security";

const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function getVal(html: string, key: string): string | null {
  const m = html.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

function getAuthURL(html: string): string | null {
  const inputMatch = html.match(/name="authURL"\s+value="([^"]+)"/);
  if (inputMatch) return inputMatch[1];
  return getVal(html, "authURL");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // ── Rate limit per user: max 5 activations per minute ──
    const rateCheck = checkRateLimit(`tv-activate:${session.userId}`, {
      maxRequests: 5,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiadas activaciones. Espera ${rateCheck.retryAfter || 60} segundos.` },
        { status: 429 }
      );
    }

    // ── Validate body ──
    const body = await request.json();
    const validation = validateBody(tvActivateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const cleanCode = validation.data.code;

    // ── Check credits ──
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 401 });
    }
    const TV_ACTIVATE_COST = await getConfig("TV_ACTIVATE_COST", 5);
    if (user.credits < TV_ACTIVATE_COST) {
      return NextResponse.json(
        { success: false, error: `Necesitas ${TV_ACTIVATE_COST} créditos. Tienes ${user.credits}` },
        { status: 400 }
      );
    }

    // ── Pick cookie with rotation ──
    const cookies = await prisma.cookie.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ usedCount: "asc" }, { lastUsed: "asc" }],
      take: 5,
    });

    if (!cookies || cookies.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay cookies disponibles.", noCookies: true },
        { status: 503 }
      );
    }

    const { extractCookiesFromText, buildCookieString } = await import("@/lib/netflix-checker");

    const cookie = cookies[Math.floor(Math.random() * cookies.length)];
    const cookieDict = extractCookiesFromText(cookie.rawCookie);

    if (!cookieDict || !cookieDict["NetflixId"] || !cookieDict["SecureNetflixId"]) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: { status: "DEAD", lastError: "No se pudo parsear la cookie", lastUsed: new Date() },
      });
      return NextResponse.json({ success: false, error: "Cookie dañada, intenta de nuevo", retry: true });
    }

    // ── Step 1: GET /tv8 ──
    const rawCookie = buildCookieString(cookieDict, false);

    let tv8Response: Response;
    try {
      tv8Response = await fetch("https://www.netflix.com/tv8", {
        method: "GET",
        headers: {
          "User-Agent": DESKTOP_UA,
          "Cookie": rawCookie,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "manual",
      });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: `Error de conexión: ${err.message}` }, { status: 500 });
    }

    if ([301, 302, 303, 307].includes(tv8Response.status)) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: { status: "DEAD", lastError: "Cookie expirada (redirect en /tv8)", lastUsed: new Date() },
      });
      return NextResponse.json({ success: false, error: "Cookie expirada, intenta de nuevo", retry: true });
    }

    if (tv8Response.status !== 200) {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: { status: "DEAD", lastError: `Status ${tv8Response.status} en /tv8`, lastUsed: new Date() },
      });
      return NextResponse.json({ success: false, error: "Cookie no válida, intenta de nuevo", retry: true });
    }

    const html = await tv8Response.text();

    const membershipStatus = getVal(html, "membershipStatus");
    if (membershipStatus !== "CURRENT_MEMBER") {
      await prisma.cookie.update({
        where: { id: cookie.id },
        data: { status: "DEAD", lastError: `Estado: ${membershipStatus || "UNKNOWN"}`, lastUsed: new Date() },
      });
      return NextResponse.json({ success: false, error: "La cookie no tiene suscripción activa", retry: true });
    }

    const authURL = getAuthURL(html);
    if (!authURL) {
      return NextResponse.json({ success: false, error: "Error interno: no se obtuvo authURL" }, { status: 500 });
    }

    // ── Step 2: POST /tv8 ──
    const payload = new URLSearchParams({
      flow: "websiteSignUp",
      authURL: authURL,
      flowMode: "enterTvLoginRendezvousCode",
      withFields: "tvLoginRendezvousCode,isTvUrl2",
      tvLoginRendezvousCode: cleanCode,
      action: "nextAction",
    });

    let activateResponse: Response;
    try {
      activateResponse = await fetch("https://www.netflix.com/tv8", {
        method: "POST",
        headers: {
          "User-Agent": DESKTOP_UA,
          "Cookie": rawCookie,
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": "https://www.netflix.com/tv8",
          "Origin": "https://www.netflix.com",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        body: payload.toString(),
        redirect: "manual",
      });
    } catch (err: any) {
      return NextResponse.json({ success: false, error: `Error de conexión: ${err.message}` }, { status: 500 });
    }

    // ── Step 3: Parse result ──
    let resultMessage: string;
    let success = false;

    if ([301, 302, 303, 307].includes(activateResponse.status)) {
      const location = activateResponse.headers.get("Location") || "";
      if (location.includes("/tv/out/success")) {
        success = true;
        resultMessage = `TV activada con éxito con cookie #${cookie.id.slice(0, 6)}`;
      } else if (location.includes("/login")) {
        resultMessage = "La sesión cayó al intentar activar. Intenta de nuevo.";
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { status: "DEAD", lastError: "Sesión cayó durante activación TV", lastUsed: new Date() },
        });
      } else {
        resultMessage = "Redirección inesperada. Intenta de nuevo.";
      }
    } else {
      const errText = await activateResponse.text().catch(() => "");
      const nfMessage = errText.match(/class="nf-message-contents"[^>]*>([\s\S]*?)<\/div>/);
      resultMessage = nfMessage ? nfMessage[1].trim() : "Error al enviar el código. Verifica e intenta.";
    }

    if (success) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { credits: { decrement: await getConfig("TV_ACTIVATE_COST", 5) } },
        }),
        prisma.cookie.update({
          where: { id: cookie.id },
          data: { usedCount: { increment: 1 }, lastUsed: new Date() },
        }),
        prisma.transaction.create({
          data: {
            userId: session.userId,
            type: "TV_ACTIVATE",
            credits: -await getConfig("TV_ACTIVATE_COST", 5),
            description: `Activación TV (${cleanCode}) con cookie #${cookie.id.slice(0, 6)}`,
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        message: resultMessage,
        remainingCredits: user.credits - await getConfig("TV_ACTIVATE_COST", 5),
      });
    }

    return NextResponse.json({ success: false, error: resultMessage }, { status: 400 });
  } catch (err: any) {
    console.error("TV Activate error:", err);
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
