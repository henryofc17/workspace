import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/users/[id] — get user detail with referrals + transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        role: true,
        credits: true,
        referralCode: true,
        referredBy: true,
        ipAddress: true,
        createdAt: true,
        updatedAt: true,
        referrer: {
          select: { id: true, username: true },
        },
        referrals: {
          select: {
            id: true,
            username: true,
            credits: true,
            role: true,
            createdAt: true,
            _count: { select: { referrals: true, transactions: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        transactions: {
          select: {
            id: true,
            type: true,
            credits: true,
            description: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            transactions: true,
            referrals: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
