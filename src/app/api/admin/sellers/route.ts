import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logSecurityEvent } from "@/lib/security";

// GET /api/admin/sellers — list all sellers
export async function GET() {
  try {
    const session = await requireAdmin();
    const sellers = await prisma.user.findMany({
      where: { role: "SELLER" },
      select: {
        id: true,
        username: true,
        credits: true,
        createdAt: true,
        _count: {
          select: { managedUsers: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, sellers });
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

// POST /api/admin/sellers — create new seller
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { username, password, credits } = body;

    if (!username || typeof username !== "string" || username.trim().length < 3 || username.trim().length > 30) {
      return NextResponse.json({ success: false, error: "Usuario debe tener entre 3 y 30 caracteres" }, { status: 400 });
    }

    if (!password || typeof password !== "string" || password.length < 4 || password.length > 64) {
      return NextResponse.json({ success: false, error: "Contraseña debe tener entre 4 y 64 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({
      where: { username: { equals: username.trim(), mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Nombre de usuario ya existe" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const seller = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        role: "SELLER",
        credits: Number(credits) || 0,
      },
      select: { id: true, username: true, role: true, credits: true, createdAt: true },
    });

    logSecurityEvent({
      level: "info",
      event: "ADMIN_CREATE_USER",
      userId: session.userId,
      username: session.username,
      details: { createdSeller: seller.username, credits },
    });

    return NextResponse.json({ success: true, seller });
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

// DELETE /api/admin/sellers — delete seller by id
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("id");

    if (!sellerId) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    if (!/^[\w-]+$/.test(sellerId)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    if (sellerId === session.userId) {
      return NextResponse.json({ success: false, error: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { username: true, role: true },
    });

    if (!seller || seller.role !== "SELLER") {
      return NextResponse.json({ success: false, error: "Seller no encontrado" }, { status: 404 });
    }

    // Unlink all managed users from this seller
    await prisma.user.updateMany({
      where: { sellerId },
      data: { sellerId: null },
    });

    // Delete seller's transactions then seller
    await prisma.transaction.deleteMany({ where: { userId: sellerId } });
    await prisma.user.delete({ where: { id: sellerId } });

    logSecurityEvent({
      level: "warn",
      event: "ADMIN_DELETE_USER",
      userId: session.userId,
      username: session.username,
      details: { deletedSellerId: sellerId, deletedSellerName: seller.username },
    });

    return NextResponse.json({ success: true });
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
