import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id } = await params;

    // Validate ID format
    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

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
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
