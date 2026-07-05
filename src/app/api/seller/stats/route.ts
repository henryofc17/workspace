import { NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/seller/stats — seller dashboard stats
export async function GET() {
  try {
    const session = await requireSeller();

    // Get seller's own credits
    const [seller, totalUsers, totalUsersCreditsResult, activeUsersToday, recentTransactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true },
      }),
      prisma.user.count({
        where: { sellerId: session.userId },
      }),
      prisma.user.aggregate({
        where: { sellerId: session.userId },
        _sum: { credits: true },
      }),
      prisma.user.count({
        where: {
          sellerId: session.userId,
          transactions: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          },
        },
      }),
      prisma.transaction.findMany({
        where: {
          user: { sellerId: session.userId },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          type: true,
          credits: true,
          description: true,
          createdAt: true,
          user: { select: { username: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        myCredits: seller?.credits || 0,
        totalUsersCredits: totalUsersCreditsResult._sum.credits || 0,
        activeUsersToday,
      },
      recentTransactions,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
