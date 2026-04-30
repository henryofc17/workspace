import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkCookie } from "@/lib/netflix-checker";

export async function POST() {
  try {
    const cookies = await prisma.cookie.findMany();

    let updated = 0;

    for (const c of cookies) {
      try {
        const result = await checkCookie(c.rawCookie);

        await prisma.cookie.update({
          where: { id: c.id },
          data: {
            status: result.valid ? "ACTIVE" : "DEAD",
            lastError: result.valid ? null : result.error || "Invalid",
            lastUsed: new Date(),
            country: result.country || null,
            plan: result.plan || null,
          },
        });

        updated++;
      } catch (err) {
        await prisma.cookie.update({
          where: { id: c.id },
          data: {
            status: "DEAD",
            lastError: "Check failed",
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updated} cookies verificadas`,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Error verificando cookies" },
      { status: 500 }
    );
  }
}
