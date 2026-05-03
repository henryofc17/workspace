import { NextRequest, NextResponse } from "next/server";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validateBody, createUserSchema } from "@/lib/validators";
import { logSecurityEvent, SecurityEvents, getClientIP } from "@/lib/security";

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
    const session = await requireAdmin();
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
          select: { transactions: true, referrals: true },
        },
        referrer: {
          select: { username: true, id: true },
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
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/admin/users — create new user
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const validation = validateBody(createUserSchema, body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { username, password, credits } = validation.data;

    const existing = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ success: false, error: "Usuario ya existe" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let referralCode = generateReferralCode();
    let codeExists = await prisma.user.findUnique({ where: { referralCode } });
    while (codeExists) {
      referralCode = generateReferralCode();
      codeExists = await prisma.user.findUnique({ where: { referralCode } });
    }

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        passwordPlain: password,
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
          description: "Créditos iniciales otorgados por admin",
        },
      });
    }

    logSecurityEvent({
      level: "info",
      event: "ADMIN_CREATE_USER",
      userId: session.userId,
      username: session.username,
      details: { createdUser: user.username, credits },
    });

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

// DELETE /api/admin/users — delete user by id
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    // Validate userId format (cuid)
    if (!/^[\w-]+$/.test(userId)) {
      return NextResponse.json({ success: false, error: "ID inválido" }, { status: 400 });
    }

    if (userId === session.userId) {
      return NextResponse.json({ success: false, error: "No puedes eliminarte a ti mismo" }, { status: 400 });
    }

    const deletedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    await prisma.transaction.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    logSecurityEvent({
      level: "warn",
      event: "ADMIN_DELETE_USER",
      userId: session.userId,
      username: session.username,
      details: { deletedUserId: userId, deletedUsername: deletedUser?.username },
    });

    return NextResponse.json({ success: true });
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
