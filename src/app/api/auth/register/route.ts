import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createTokenPair, setAuthCookies } from "@/lib/auth";
import {
  getClientIP,
  logSecurityEvent,
  SecurityEvents,
  sanitizeString,
} from "@/lib/security";
import { validateBody, registerSchema } from "@/lib/validators";
import { getConfig } from "@/lib/config";
import { checkIPRisk } from "@/lib/ip-guard";
import {
  isIPBlockedServer,
  registerRatelimit,
  checkRateLimitRedis,
} from "@/lib/ratelimit";
import { verifyTurnstileEdge } from "@/lib/edge-ratelimit";

// ─── Referral Code Generator ────────────────────────────────────────────────

async function generateUniqueReferralCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  let attempts = 0;
  while (attempts < 20) {
    code = "HFLIX-";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
    attempts++;
  }
  return "HFLIX-" + Date.now().toString(36).toUpperCase();
}

// ─── Register Handler ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const clientIP = getClientIP(request as any);

    // ── Redis IP Blocklist check ──
    const blockCheck = await isIPBlockedServer(clientIP);
    if (blockCheck.blocked) {
      return NextResponse.json(
        { success: false, error: "Acceso bloqueado temporalmente." },
        { status: 429 }
      );
    }

    // ── IP Fraud Check ──
    const ipRisk = await checkIPRisk(clientIP);
    if (ipRisk.blocked) {
      return NextResponse.json(
        { success: false, error: "No se permite el registro desde esta red." },
        { status: 403 }
      );
    }

    // ── Rate limit: max 3 registrations per IP per 15 min ──
    const redisRateCheck = await checkRateLimitRedis(registerRatelimit, clientIP);
    if (!redisRateCheck.allowed) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.REGISTER_BLOCKED,
        ip: clientIP,
        details: { reason: "redis_rate_limit", retryAfter: redisRateCheck.retryAfter },
      });
      return NextResponse.json(
        { success: false, error: `Demasiados registros. Espera ${redisRateCheck.retryAfter || 60} segundos.` },
        { status: 429, headers: { "Retry-After": String(redisRateCheck.retryAfter || 900) } }
      );
    }

    // ── Parse & validate body ──
    const body = await request.json();
    const validation = validateBody(registerSchema, body);
    if (!validation.success) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.INPUT_VALIDATION_FAILED,
        ip: clientIP,
        details: { field: "register", error: validation.error },
      });
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { username, password, fingerprint, turnstileToken, referralCode } = validation.data;

    const REGISTER_BONUS = await getConfig("REGISTER_BONUS", 3);

    // ── Verify Turnstile ──
    const turnstileResult = await verifyTurnstileEdge(turnstileToken, clientIP);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { success: false, error: turnstileResult.error || "Verificación fallida. Intenta de nuevo.", turnstileFailed: true },
        { status: 400 }
      );
    }

    // ── Block reserved usernames ──
    const reserved = /^(admin|moderator|root|support|help|netflix|nfchecker|hachejota|staff|system)/i;
    if (reserved.test(username)) {
      return NextResponse.json({ success: false, error: "Nombre de usuario no disponible." }, { status: 400 });
    }

    // ── ANTI-ABUSE: Max 1 account per IP ──
    const ipCount = await prisma.user.count({ where: { ipAddress: clientIP } });
    if (ipCount >= 1) {
      return NextResponse.json({ success: false, error: "Solo se permite una cuenta por dispositivo." }, { status: 429 });
    }

    // ── ANTI-ABUSE: Fingerprint check ──
    const fpCount = await prisma.user.count({ where: { fingerprint } });
    if (fpCount >= 1) {
      return NextResponse.json({ success: false, error: "Ya tienes una cuenta registrada en este navegador." }, { status: 429 });
    }

    // ── Check username unique ──
    const existing = await prisma.user.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Ese usuario ya existe" }, { status: 400 });
    }

    // ── Create user ──
    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = await generateUniqueReferralCode();

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: "USER",
        credits: REGISTER_BONUS,
        ipAddress: clientIP,
        fingerprint: fingerprint || null,
        referralCode: newReferralCode,
      },
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        type: "REGISTER_BONUS",
        credits: REGISTER_BONUS,
        description: "Créditos de bienvenida",
      },
    });

    // ── Process Referral ──
    let referralMessage = "";
    if (referralCode && referralCode.trim()) {
      const trimmedCode = referralCode.trim().toUpperCase();

      // Anti-abuse: find the referrer
      const referrer = await prisma.user.findUnique({ where: { referralCode: trimmedCode } });

      if (!referrer) {
        referralMessage = " Código de referido no válido, pero tu cuenta fue creada.";
      } else if (referrer.id === user.id) {
        referralMessage = " No puedes usar tu propio código de referido.";
      } else if (referrer.ipAddress === clientIP) {
        // Anti-abuse: same IP address
        referralMessage = " No puedes referirte desde la misma red.";
        logSecurityEvent({
          level: "warn",
          event: SecurityEvents.REGISTER_BLOCKED,
          ip: clientIP,
          details: { reason: "referral_same_ip", referrerId: referrer.id },
        });
      } else {
        // Valid referral
        const REFERRER_CREDIT = await getConfig("REFERRER_CREDIT", 3);
        const REFERRED_CREDIT = await getConfig("REFERRED_CREDIT", 2);

        // Update referrer credits
        await prisma.user.update({
          where: { id: referrer.id },
          data: { credits: { increment: REFERRER_CREDIT } },
        });

        await prisma.transaction.create({
          data: {
            userId: referrer.id,
            type: "REFERRAL_BONUS",
            credits: REFERRER_CREDIT,
            description: `Referido: ${user.username} usó tu código`,
          },
        });

        // Update referred user credits
        await prisma.user.update({
          where: { id: user.id },
          data: { credits: { increment: REFERRED_CREDIT }, referredBy: referrer.id },
        });

        await prisma.transaction.create({
          data: {
            userId: user.id,
            type: "REFERRAL_BONUS",
            credits: REFERRED_CREDIT,
            description: `Bonificación por código de referido de ${referrer.username}`,
          },
        });

        referralMessage = ` ¡Ganaste ${REFERRED_CREDIT} créditos extra por el código de referido!`;

        logSecurityEvent({
          level: "info",
          event: SecurityEvents.REGISTER_SUCCESS,
          ip: clientIP,
          userId: referrer.id,
          username: referrer.username,
          details: { referral: true, referredUser: user.username },
        });
      }
    }

    // ── Generate tokens & respond ──
    const tokens = await createTokenPair({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    // Fetch updated credits (with referral bonus if any)
    const updatedUser = await prisma.user.findUnique({ where: { id: user.id }, select: { credits: true } });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: updatedUser?.credits || user.credits,
      },
      message: `¡Cuenta creada! Tienes ${updatedUser?.credits || REGISTER_BONUS} créditos de bienvenida.${referralMessage}`,
    });

    setAuthCookies(response, tokens);

    logSecurityEvent({
      level: "info",
      event: SecurityEvents.REGISTER_SUCCESS,
      ip: clientIP,
      userId: user.id,
      username: user.username,
    });

    return response;
  } catch (err: any) {
    console.error("[REGISTER_ERROR]", err instanceof Error ? err.message : "Unknown error");
    return NextResponse.json({ success: false, error: "Error del servidor. Intenta de nuevo." }, { status: 500 });
  }
}
