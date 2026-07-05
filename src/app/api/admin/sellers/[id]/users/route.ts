import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/sellers/[id]/users — list users managed by a specific seller
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

    // Verify the seller exists
    const seller = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!seller || seller.role !== "SELLER") {
      return NextResponse.json({ success: false, error: "Seller no encontrado" }, { status: 404 });
    }

    const users = await prisma.user.findMany({
      where: { sellerId: id },
      select: {
        id: true,
        username: true,
        role: true,
        credits: true,
        region: true,
        createdAt: true,
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, users });
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

// PUT /api/admin/sellers/[id]/users — assign a user to this seller
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();

    const { id: sellerId } = await params;

    if (!/^[\w-]+$/.test(sellerId)) {
      return NextResponse.json({ success: false, error: "ID de seller inválido" }, { status: 400 });
    }

    // Verify the seller exists
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, role: true },
    });

    if (!seller || seller.role !== "SELLER") {
      return NextResponse.json({ success: false, error: "Seller no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || typeof userId !== "string" || !/^[\w-]+$/.test(userId)) {
      return NextResponse.json({ success: false, error: "ID de usuario inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, sellerId: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    if (user.role === "ADMIN" || user.role === "SELLER") {
      return NextResponse.json({ success: false, error: "No se puede asignar un admin o seller a otro seller" }, { status: 400 });
    }

    if (action === "assign") {
      await prisma.user.update({
        where: { id: userId },
        data: { sellerId },
      });
      return NextResponse.json({ success: true, message: `Usuario "${user.username}" asignado al seller` });
    } else if (action === "unassign") {
      await prisma.user.update({
        where: { id: userId },
        data: { sellerId: null },
      });
      return NextResponse.json({ success: true, message: `Usuario "${user.username}" desvinculado del seller` });
    } else {
      return NextResponse.json({ success: false, error: "Acción inválida. Usa 'assign' o 'unassign'" }, { status: 400 });
    }
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
