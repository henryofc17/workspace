import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const onlyActive = searchParams.get("active") === "true";

    const where = onlyActive ? { status: "ACTIVE" } : {};
    const cookies = await prisma.cookie.findMany({ where });

    if (cookies.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay cookies para validar",
        results: { checked: 0, alive: 0, dead: 0 },
      });
    }

    const { checkCookie } = await import("@/lib/netflix-checker");
    let alive = 0;
    let dead = 0;

    for (const cookie of cookies) {
      const dict = extractCookiesFromText(cookie.rawCookie);

      if (!dict) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { status: "DEAD", lastError: "No se pudo parsear" },
        });
        dead++;
        continue;
      }

      try {
        const result = await checkCookie(dict);
        if (result.success) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "ACTIVE", lastUsed: new Date() },
          });
          alive++;
        } else {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "DEAD", lastError: result.error || "Cookie inválida", lastUsed: new Date() },
          });
          dead++;
        }
      } catch (err: any) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { status: "DEAD", lastError: err.message || "Error de conexión" },
        });
        dead++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Validación completa: ${alive} vivas, ${dead} muertas`,
      results: { checked: cookies.length, alive, dead },
    });
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
