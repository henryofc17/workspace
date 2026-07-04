import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    function todayStart() {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }

    const [user, transactions, freeKeysToday] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true },
      }),
      prisma.transaction.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.creditKey.count({
        where: {
          usedBy: session.userId,
          usedAt: { gte: todayStart() },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      credits: user?.credits || 0,
      transactions,
      freeKeysToday,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
