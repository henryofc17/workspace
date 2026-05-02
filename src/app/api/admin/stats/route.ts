import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const [totalUsers, totalCookies, activeCookies, deadCookies, totalTransactions] = await Promise.all([
      prisma.user.count({ where: { role: "USER" } }),
      prisma.cookie.count(),
      prisma.cookie.count({ where: { status: "ACTIVE" } }),
      prisma.cookie.count({ where: { status: "DEAD" } }),
      prisma.transaction.count(),
    ]);

    const recentTransactions = await prisma.transaction.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { username: true } },
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalCookies,
        activeCookies,
        deadCookies,
        totalTransactions,
        allCookiesDead: totalCookies > 0 && activeCookies === 0,
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
