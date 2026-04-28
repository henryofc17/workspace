import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const [user, transactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true },
      }),
      prisma.transaction.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json({
      success: true,
      credits: user?.credits || 0,
      transactions,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
