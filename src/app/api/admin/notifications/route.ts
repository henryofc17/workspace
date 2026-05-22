import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List all notifications
export async function GET() {
  try {
    const session = await requireAdmin();

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { username: true } } },
    });

    return NextResponse.json({ success: true, notifications });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// POST: Create a new notification
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json();
    const { title, message, type } = body;

    if (!title || !message) {
      return NextResponse.json({ success: false, error: "Título y mensaje requeridos" }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        title: String(title).trim(),
        message: String(message).trim(),
        type: type || "info",
        active: true,
        createdBy: session.userId,
      },
    });

    return NextResponse.json({ success: true, notification });
  } catch (err: any) {
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// PUT: Toggle notification active/inactive
export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const { id, active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { active: active !== undefined ? Boolean(active) : true },
    });

    return NextResponse.json({ success: true, notification });
  } catch (err: any) {
    if (err.message === "FORBIDDEN" || err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}

// DELETE: Delete a notification
export async function DELETE(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID requerido" }, { status: 400 });
    }

    await prisma.notification.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Notificación eliminada" });
  } catch (err: any) {
    if (err.message === "FORBIDDEN" || err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
