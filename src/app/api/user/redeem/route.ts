import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody, redeemSchema } from "@/lib/validators";
import { logSecurityEvent, SecurityEvents, checkRateLimit } from "@/lib/security";
import { getConfig } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // ── Rate limit: max 5 redeem attempts per user per hour ──
    const rateCheck = checkRateLimit(`redeem:${session.userId}`, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
      blockDurationMs: 2 * 60 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Demasiados intentos. Espera ${rateCheck.retryAfter || 120} minutos.` },
        { status: 429 }
      );
    }

    // ── Validate body ──
    const body = await request.json();
    const validation = validateBody(redeemSchema, body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const cleanCode = validation.data.code;

    const REFERRAL_BONUS = await getConfig("REFERRAL_BONUS", 5);
    const REDEEM_BONUS = await getConfig("REDEEM_BONUS", 3);

    // ── Cannot use own code ──
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { referralCode: true },
    });

    if (me?.referralCode === cleanCode) {
      return NextResponse.json({ success: false, error: "No puedes usar tu propio código" }, { status: 400 });
    }

    // ── Already redeemed ──
    const myReferral = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { referredBy: true },
    });

    if (myReferral?.referredBy) {
      return NextResponse.json({ success: false, error: "Ya canjeaste un código de referido" }, { status: 400 });
    }

    // ── Find referrer ──
    const referrer = await prisma.user.findUnique({ where: { referralCode: cleanCode } });

    if (!referrer) {
      return NextResponse.json({ success: false, error: "Código de referido inválido" }, { status: 400 });
    }

    // ── ANTI-ABUSE: Referrer must be at least 1 hour old ──
    const referrerAge = Date.now() - referrer.createdAt.getTime();
    if (referrerAge < 60 * 60 * 1000) {
      return NextResponse.json({ success: false, error: "Ese código es muy reciente." }, { status: 400 });
    }

    // ── ANTI-ABUSE: Same IP / fingerprint ──
    const myUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { ipAddress: true, fingerprint: true },
    });

    if (myUser?.ipAddress && referrer.ipAddress && myUser.ipAddress === referrer.ipAddress) {
      logSecurityEvent({
        level: "warn",
        event: SecurityEvents.SUSPICIOUS_ACTIVITY,
        userId: session.userId,
        username: session.username,
        details: { type: "self_referral_same_ip", referrerId: referrer.id },
      });
      return NextResponse.json({ success: false, error: "No puedes usar un código de tu misma red." }, { status: 400 });
    }

    if (myUser?.fingerprint && referrer.fingerprint && myUser.fingerprint === referrer.fingerprint) {
      return NextResponse.json({ success: false, error: "No puedes usar tu propio código." }, { status: 400 });
    }

    // ── ANTI-ABUSE: One referral per referrer per IP ──
    if (myUser?.ipAddress) {
      const sameRefSameIP = await prisma.user.count({
        where: { referredBy: cleanCode, ipAddress: myUser.ipAddress },
      });
      if (sameRefSameIP > 0) {
        return NextResponse.json({ success: false, error: "Ya existe una cuenta referida por este código en tu red." }, { status: 400 });
      }
    }

    // ── Apply referral ──
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { referredBy: cleanCode, credits: { increment: REDEEM_BONUS } },
      }),
      prisma.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: REFERRAL_BONUS } },
      }),
      prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: "REFERRAL_BONUS",
          credits: REFERRAL_BONUS,
          description: `Bonus por referido: ${session.username}`,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "REFERRAL_BONUS",
          credits: REDEEM_BONUS,
          description: `Canjeó código de referido de ${referrer.username}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Código canjeado. Tú recibiste +${REDEEM_BONUS} créditos y ${referrer.username} recibió +${REFERRAL_BONUS} créditos.`,
      referrerUsername: referrer.username,
    });
  } catch {
    console.error("Redeem error");
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
