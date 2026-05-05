import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getClientIP, logSecurityEvent, sanitizeString, checkRateLimit } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    // ── Rate limit: max 3 password changes per 30 minutes per user ──
    const rateCheck = checkRateLimit(`change-password:${session.userId}`, {
      maxRequests: 3,
      windowMs: 30 * 60 * 1000,
      blockDurationMs: 30 * 60 * 1000,
    });
    if (!rateCheck.allowed) {
      logSecurityEvent({
        level: "warn",
        event: "PASSWORD_CHANGE_RATE_LIMITED",
        userId: session.userId,
        username: session.username,
        details: { retryAfter: rateCheck.retryAfter },
      });
      return NextResponse.json(
        { success: false, error: `Demasiados cambios de contraseña. Espera ${rateCheck.retryAfter || 120} minutos.` },
        { status: 429 }
      );
    }

    const clientIP = getClientIP(request as any);
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, error: "Todos los campos son requeridos" }, { status: 400 });
    }

    if (typeof newPassword !== "string" || newPassword.length < 4 || newPassword.length > 64) {
      return NextResponse.json({ success: false, error: "La nueva contraseña debe tener entre 4 y 64 caracteres" }, { status: 400 });
    }

    // Find user with password
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 401 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      logSecurityEvent({
        level: "warn",
        event: "PASSWORD_CHANGE_FAILED",
        ip: clientIP,
        userId: user.id,
        username: user.username,
        details: { reason: "wrong_current_password" },
      });
      return NextResponse.json({ success: false, error: "Contraseña actual incorrecta" }, { status: 400 });
    }

    // Hash new password and update
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: session.userId },
      data: {
        password: hashedPassword,
      },
    });

    logSecurityEvent({
      level: "info",
      event: "PASSWORD_CHANGE_SUCCESS",
      ip: clientIP,
      userId: user.id,
      username: user.username,
    });

    return NextResponse.json({ success: true, message: "Contraseña actualizada correctamente" });
  } catch {
    return NextResponse.json({ success: false, error: "Error del servidor" }, { status: 500 });
  }
}
