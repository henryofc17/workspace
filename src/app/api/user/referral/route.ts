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

    const [user, referredCount, referralEarnings, referredUsers] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { referralCode: true, referredBy: true },
      }),
      prisma.user.count({
        where: { referredBy: session.userId },
      }),
      prisma.transaction.aggregate({
        where: { userId: session.userId, type: "REFERRAL_BONUS" },
        _sum: { credits: true },
      }),
      prisma.user.findMany({
        where: { referredBy: session.userId },
        select: { id: true, username: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

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
