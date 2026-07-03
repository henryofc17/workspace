import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/seller/users/[id] — get user detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSeller();
    const { id } = await params;

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
        sellerId: true,
        ipAddress: true,
        region: true,
        createdAt: true,
        updatedAt: true,
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
          select: { transactions: true },
        },
      },
    });

    if (!user || user.sellerId !== session.userId) {
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

// PUT /api/seller/users/[id] — update managed user (password or credits)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSeller();
    const { id } = await params;

    if (!/^[\w-]+$/.test(id)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.sellerId !== session.userId) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado o no te pertenece" }, { status: 404 });
    }

    const body = await request.json();
    const { newPassword, creditAmount, creditDescription } = body;

    // Change password
    if (newPassword && typeof newPassword === "string") {
      if (newPassword.length < 4 || newPassword.length > 64) {
        return NextResponse.json({ success: false, error: "Contraseña debe tener entre 4 y 64 caracteres" }, { status: 400 });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id },
        data: { password: hashedPassword },
      });
    }

    // Update credits
    if (creditAmount !== undefined && creditAmount !== null) {
      const amount = Number(creditAmount);
      if (isNaN(amount)) {
        return NextResponse.json({ success: false, error: "Cantidad inválida" }, { status: 400 });
      }

      // If granting credits (positive amount), deduct from seller's own balance
      if (amount > 0) {
        const seller = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { credits: true },
        });

        if (!seller || seller.credits < amount) {
          return NextResponse.json(
            { success: false, error: `Créditos insuficientes. Tienes ${seller?.credits || 0} créditos.` },
            { status: 400 }
          );
        }

        // Atomic transaction: deduct from seller, add to user, record transactions
        const updatedUser = await prisma.$transaction(async (tx) => {
          // Deduct from seller
          await tx.user.update({
            where: { id: session.userId },
            data: { credits: { decrement: amount } },
          });

          // Add credits to user
          const target = await tx.user.update({
            where: { id },
            data: { credits: { increment: amount } },
            select: { id: true, username: true, credits: true },
          });

          // Record grant transaction for user
          await tx.transaction.create({
            data: {
              userId: id,
              type: "SELLER_GRANT",
              credits: amount,
              description: creditDescription || "Créditos otorgados por seller",
            },
          });

          // Record deduction transaction for seller
          await tx.transaction.create({
            data: {
              userId: session.userId,
              type: "SELLER_DEDUCT",
              credits: -amount,
              description: `Créditos transferidos a usuario ${target.username}`,
            },
          });

          return target;
        });

        return NextResponse.json({ success: true, user: updatedUser });
      }

      // Negative amount (deduct from user) — atomic with guard
      try {
        const updatedUser = await prisma.$transaction(async (tx) => {
          const u = await tx.user.update({
            where: { id, credits: { gte: Math.abs(amount) } },
            data: { credits: { increment: amount } },
            select: { id: true, username: true, credits: true },
          });
          await tx.transaction.create({
            data: {
              userId: id,
              type: "SELLER_DEDUCT",
              credits: amount,
              description: creditDescription || "Créditos deducidos por seller",
            },
          });
          return u;
        });
        return NextResponse.json({ success: true, user: updatedUser });
      } catch {
        return NextResponse.json({ success: false, error: "Créditos insuficientes" }, { status: 400 });
      }
    }

    // If only password was changed
    const updatedUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, credits: true },
    });

    return NextResponse.json({ success: true, user: updatedUser, message: "Contraseña actualizada" });
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
