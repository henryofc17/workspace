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

    const numericAmount = Number(amount);

    // If granting credits (positive amount) to a SELLER, deduct from admin's own credits
    if (numericAmount > 0 && user.role === "SELLER") {
      const adminUser = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { credits: true },
      });

      if (!adminUser || adminUser.credits < numericAmount) {
        return NextResponse.json(
          { success: false, error: `Créditos insuficientes. Tienes ${adminUser?.credits || 0} créditos.` },
          { status: 400 }
        );
      }

      // Use a transaction to ensure atomicity: deduct from admin, add to seller
      const [updatedTarget, ,] = await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: { credits: { increment: numericAmount } },
          select: { id: true, username: true, credits: true },
        }),
        prisma.user.update({
          where: { id: session.userId },
          data: { credits: { decrement: numericAmount } },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: "ADMIN_GRANT",
            credits: numericAmount,
            description: description || "Créditos otorgados por admin",
          },
        }),
      ]);

      // Also record deduction transaction for admin
      await prisma.transaction.create({
        data: {
          userId: session.userId,
          type: "ADMIN_DEDUCT",
          credits: -numericAmount,
          description: `Transferencia a seller ${updatedTarget.username}`,
        },
      });

      logSecurityEvent({
        level: "info",
        event: "ADMIN_UPDATE_CREDITS",
        userId: session.userId,
        username: session.username,
        details: { targetUser: updatedTarget.username, amount, newCredits: updatedTarget.credits, deductedFromAdmin: numericAmount },
      });

      return NextResponse.json({ success: true, user: updatedTarget });
    }

    // For non-seller users or negative amounts (deductions), use atomic increment with guard
    if (numericAmount < 0) {
      // For deductions, use transaction with balance check
      try {
        const updatedUser = await prisma.$transaction(async (tx) => {
          const u = await tx.user.update({
            where: { id: userId, credits: { gte: Math.abs(numericAmount) } },
            data: { credits: { increment: numericAmount } },
            select: { id: true, username: true, credits: true },
          });
          await tx.transaction.create({
            data: {
              userId,
              type: "ADMIN_DEDUCT",
              credits: numericAmount,
              description: description || "Créditos deducidos por admin",
            },
          });
          return u;
        });
        logSecurityEvent({
          level: "info",
          event: "ADMIN_UPDATE_CREDITS",
          userId: session.userId,
          username: session.username,
          details: { targetUser: updatedUser.username, amount, newCredits: updatedUser.credits },
        });
        return NextResponse.json({ success: true, user: updatedUser });
      } catch {
        return NextResponse.json({ success: false, error: "Créditos insuficientes" }, { status: 400 });
      }
    }

    // For positive amounts to non-sellers, use atomic increment
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: numericAmount } },
      select: { id: true, username: true, credits: true },
    });

    await prisma.transaction.create({
      data: {
        userId,
        type: "ADMIN_GRANT",
        credits: numericAmount,
        description: description || "Créditos otorgados por admin",
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
