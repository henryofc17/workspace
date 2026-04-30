import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCookie } from "@/lib/netflix-checker";

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyActive = searchParams.get("active") === "true";

    const cookies = await prisma.cookie.findMany({
      where: onlyActive ? { status: "ACTIVE" } : {},
    });

    let alive = 0;
    let dead = 0;

    for (const cookie of cookies) {
      try {
        const result = await checkCookie(cookie.value);

        if (result.valid) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "ACTIVE", error: null },
          });
          alive++;
        } else {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "DEAD", error: result.error },
          });
          dead++;
        }
      } catch (err: any) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { status: "DEAD", error: err.message },
        });
        dead++;
      }
    }

    return NextResponse.json({
      success: true,
      total: cookies.length,
      alive,
      dead,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Error refreshing cookies" },
      { status: 500 }
    );
  }
}
