import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        referralCode: true,
        createdAt: true,
        _count: {
          select: { referrals: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    // ⏱️ mínimo 1 hora para compartir código
    const referrerAge = Date.now() - user.createdAt.getTime();
    const canShare = referrerAge >= 60 * 60 * 1000;

    // ✅ CORRECTO: usar referredById (no referralCode)
    const referrals = await prisma.user.findMany({
      where: {
        referredById: user.id,
      },
      select: {
        username: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      referralCode: user.referralCode,
      canShare,
      totalReferrals: user._count.referrals,
      referrals,
    });

  } catch (err: any) {
    console.error("Referral error:", err);

    return NextResponse.json(
      { success: false, error: "Error del servidor" },
      { status: 500 }
    );
  }
}
