import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get my referral code and stats
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { referralCode: true, referredBy: true },
    });

    // Count how many users I've referred
    const referredCount = await prisma.user.count({
      where: { referredBy: session.userId },
    });

    // Get my referral earnings
    const referralEarnings = await prisma.transaction.aggregate({
      where: { userId: session.userId, type: "REFERRAL_BONUS" },
      _sum: { credits: true },
    });

    // Get list of referred users (last 20)
    const referredUsers = await prisma.user.findMany({
      where: { referredBy: session.userId },
      select: { id: true, username: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      referralCode: user?.referralCode || null,
      referredCount,
      totalEarnings: referralEarnings._sum.credits || 0,
      referredUsers,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
