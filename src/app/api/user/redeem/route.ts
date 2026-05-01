import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const REFERRAL_BONUS = 5;

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || !code.trim()) {
      return NextResponse.json(
        { success: false, error: "Ingresa un código de referido" },
        { status: 400 }
      );
    }

    const cleanCode = code.trim().toUpperCase();

    // ── Cannot use your own code ──
    const me = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { referralCode: true },
    });

    if (me?.referralCode === cleanCode) {
      return NextResponse.json(
        { success: false, error: "No puedes usar tu propio código" },
        { status: 400 }
      );
    }

    // ── Check if already used a referral code ──
    const myReferral = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { referredBy: true },
    });

    if (myReferral?.referredBy) {
      return NextResponse.json(
        { success: false, error: "Ya canjeaste un código de referido" },
        { status: 400 }
      );
    }

    // ── Find referrer ──
    const referrer = await prisma.user.findUnique({
      where: { referralCode: cleanCode },
    });

    if (!referrer) {
      return NextResponse.json(
        { success: false, error: "Código de referido inválido" },
        { status: 400 }
      );
    }

    // ── ANTI-ABUSE: Referrer account must be at least 1 hour old ──
    const referrerAge = Date.now() - referrer.createdAt.getTime();
    if (referrerAge < 60 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: "Ese código es muy reciente. Intenta más tarde." },
        { status: 400 }
      );
    }

    // ── ANTI-ABUSE: Same IP check ──
    if (referrer.ipAddress) {
      const myIP = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { ipAddress: true },
      });
      if (myIP?.ipAddress && myIP.ipAddress === referrer.ipAddress) {
        return NextResponse.json(
          { success: false, error: "No puedes usar un código de tu misma red." },
          { status: 400 }
        );
      }
    }

    // ── ANTI-ABUSE: Same fingerprint check ──
    if (referrer.fingerprint) {
      const myFP = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { fingerprint: true },
      });
      if (myFP?.fingerprint && myFP.fingerprint === referrer.fingerprint) {
        return NextResponse.json(
          { success: false, error: "No puedes usar tu propio código de referido." },
          { status: 400 }
        );
      }
    }

    // ── ANTI-ABUSE: One referral per referrer per IP ──
    const myIP = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { ipAddress: true },
    });
    if (myIP?.ipAddress) {
      const sameRefSameIP = await prisma.user.count({
        where: {
          referredBy: cleanCode,
          ipAddress: myIP.ipAddress,
        },
      });
      if (sameRefSameIP > 0) {
        return NextResponse.json(
          { success: false, error: "Ya existe una cuenta referida por este código en tu red." },
          { status: 400 }
        );
      }
    }

    // ── Apply referral ──
    await prisma.$transaction([
      // Mark user as referred
      prisma.user.update({
        where: { id: session.userId },
        data: { referredBy: cleanCode },
      }),
      // Give bonus to referrer
      prisma.user.update({
        where: { id: referrer.id },
        data: { credits: { increment: REFERRAL_BONUS } },
      }),
      // Log referrer's bonus
      prisma.transaction.create({
        data: {
          userId: referrer.id,
          type: "REFERRAL_BONUS",
          credits: REFERRAL_BONUS,
          description: `Bonus por referido: ${session.username}`,
        },
      }),
      // Log my action
      prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "REFERRAL_BONUS",
          credits: 0,
          description: `Canjeó código de referido de ${referrer.username}`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: `Código canjeado. ${referrer.username} recibió +${REFERRAL_BONUS} créditos.`,
      referrerUsername: referrer.username,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
