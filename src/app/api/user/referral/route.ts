import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        referralCode: true,
        createdAt: true,
        _count: {
          select: { referrals: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 401 });
    }

    // Referrer must be at least 10 minutes old to share code
    const referrerAge = Date.now() - user.createdAt.getTime();
    const canShare = referrerAge >= 10 * 60 * 1000;

    // List of people this user has referred
    const referrals = await prisma.user.findMany({
      where: { referredBy: user.referralCode },
      select: {
        username: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      referralCode: user.referralCode,
      canShare,
      totalReferrals: user._count.referrals,
      referrals,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
