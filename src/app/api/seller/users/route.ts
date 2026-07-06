import { NextRequest, NextResponse } from "next/server";
import { requireSeller } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { generateReferralCode } from "@/lib/referral";

// GET /api/seller/users — list seller's managed users
export async function GET() {
  try {
    const session = await requireSeller();

    const users = await prisma.user.findMany({
      where: { sellerId: session.userId },
      select: {
        id: true,
        username: true,
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

// POST /api/seller/users — create user under seller
export async function POST(request: NextRequest) {
  try {
    const session = await requireSeller();

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
    const creditAmount = Number(credits) || 0;

    // If assigning initial credits, deduct from seller's own balance
    if (creditAmount > 0) {
      const seller = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true },
      });

      if (!seller || seller.credits < creditAmount) {
        return NextResponse.json(
          { success: false, error: `Créditos insuficientes. Tienes ${seller?.credits || 0} créditos.` },
          { status: 400 }
        );
      }

      // Atomic transaction: deduct from seller, create user with credits, record transactions
      // Generate unique referral code before transaction
      let referralCode = generateReferralCode();
      for (let i = 0; i < 20; i++) {
        const exists = await prisma.user.findUnique({ where: { referralCode } });
        if (!exists) break;
        referralCode = generateReferralCode();
      }

      const user = await prisma.$transaction(async (tx) => {
        // Deduct from seller
        await tx.user.update({
          where: { id: session.userId },
          data: { credits: { decrement: creditAmount } },
        });

        // Create user with credits
        const newUser = await tx.user.create({
          data: {
            username: username.trim(),
            password: hashedPassword,
            role: "USER",
            credits: creditAmount,
            sellerId: session.userId,
            referralCode,
          },
          select: { id: true, username: true, role: true, credits: true, createdAt: true },
        });

        // Record grant transaction for user
        await tx.transaction.create({
          data: {
            userId: newUser.id,
            type: "SELLER_GRANT",
            credits: creditAmount,
            description: "Créditos iniciales otorgados por seller",
          },
        });

        // Record deduction transaction for seller
        await tx.transaction.create({
          data: {
            userId: session.userId,
            type: "SELLER_DEDUCT",
            credits: -creditAmount,
            description: `Créditos transferidos a usuario ${newUser.username}`,
          },
        });

        return newUser;
      });

      return NextResponse.json({ success: true, user });
    }

    // No initial credits - just create user normally
    let referralCode = generateReferralCode();
    for (let i = 0; i < 20; i++) {
      const exists = await prisma.user.findUnique({ where: { referralCode } });
      if (!exists) break;
      referralCode = generateReferralCode();
    }
    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        role: "USER",
        credits: 0,
        sellerId: session.userId,
        referralCode,
      },
      select: { id: true, username: true, role: true, credits: true, createdAt: true },
    });

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

// DELETE /api/seller/users — delete managed user
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSeller();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    if (!/^[\w-]+$/.test(userId)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, sellerId: true },
    });

    if (!user || user.sellerId !== session.userId) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado o no te pertenece" }, { status: 404 });
    }

    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

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
