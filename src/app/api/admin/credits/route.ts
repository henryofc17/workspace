import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBody, updateCreditsSchema } from "@/lib/validators";
import { logSecurityEvent } from "@/lib/security";

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const validation = validateBody(updateCreditsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const { userId, amount, description } = validation.data;

    // Validate userId format
    if (!/^[\w-]+$/.test(userId)) {
      return NextResponse.json({ success: false, error: "ID de usuario inválido" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const newCredits = user.credits + Number(amount);
    if (newCredits < 0) {
      return NextResponse.json({ success: false, error: "Créditos insuficientes" }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: newCredits },
      select: { id: true, username: true, credits: true },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: Number(amount) >= 0 ? "ADMIN_GRANT" : "ADMIN_DEDUCT",
        credits: Number(amount),
        description: description || (Number(amount) >= 0 ? "Créditos otorgados por admin" : "Créditos deducidos por admin"),
      },
    });

    logSecurityEvent({
      level: "info",
      event: "ADMIN_UPDATE_CREDITS",
      userId: session.userId,
      username: session.username,
      details: { targetUser: updatedUser.username, amount, newCredits: updatedUser.credits },
    });

    return NextResponse.json({ success: true, user: updatedUser });
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
