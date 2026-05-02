import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/admin/users — list all users with referral data
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        credits: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
            referrals: true,
          },
        },
        referrer: {
          select: { username: true, id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/admin/users — create new user
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { username, password, credits } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Usuario y contraseña requeridos" }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({ success: false, error: "Usuario debe tener al menos 3 caracteres" }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ success: false, error: "Contraseña debe tener al menos 4 caracteres" }, { status: 400 });
    }

    const existing = await prisma.user.findFirst({ where: { username: { equals: username.trim(), mode: 'insensitive' } } });
    if (existing) {
      return NextResponse.json({ success: false, error: "Usuario ya existe" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code
    let referralCode = generateReferralCode();
    let codeExists = await prisma.user.findUnique({ where: { referralCode } });
    while (codeExists) {
      referralCode = generateReferralCode();
      codeExists = await prisma.user.findUnique({ where: { referralCode } });
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        password: hashedPassword,
        role: "USER",
        credits: credits || 0,
        referralCode,
      },
      select: { id: true, username: true, role: true, credits: true, createdAt: true },
    });

    if (credits && credits > 0) {
      await prisma.transaction.create({
        data: {
          userId: user.id,
          type: "ADMIN_GRANT",
          credits: Number(credits),
          description: `Créditos iniciales otorgados por admin`,
        },
      });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/users — delete user by id
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    if (userId === session.userId) {
      return NextResponse.json({ success: false, error: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    // Remove referredBy reference from any referrals
    await prisma.user.updateMany({
      where: { referredBy: (await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } }))?.referralCode || "" },
      data: { referredBy: null },
    });

    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
