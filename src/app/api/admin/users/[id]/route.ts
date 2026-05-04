import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
        region: true,
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
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// PUT /api/admin/users/[id] — admin changes user password
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();

    const { id } = await params;

    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 4 || newPassword.length > 64) {
      return NextResponse.json({ success: false, error: "Contraseña debe tener entre 4 y 64 caracteres" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
      },
    });

    return NextResponse.json({ success: true, message: `Contraseña de "${user.username}" actualizada` });
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
