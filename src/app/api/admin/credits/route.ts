import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/admin/credits — update user credits
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }

    const { userId, amount, description } = await request.json();

    if (!userId || amount === undefined || amount === null) {
      return NextResponse.json({ success: false, error: "userId y amount requeridos" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });
    }

    const newCredits = user.credits + Number(amount);
    if (newCredits < 0) {
      return NextResponse.json({ success: false, error: "Créditos insuficientes para esta operación" }, { status: 400 });
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

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
