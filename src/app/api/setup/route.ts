import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = "NF-"
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function GET() {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: "hachejota" },
    })

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: "Admin already exists",
        admin: {
          username: existingAdmin.username,
          role: existingAdmin.role,
          credits: existingAdmin.credits,
        },
      })
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash("HacheAdmin", 10)
    const admin = await prisma.user.create({
      data: {
        username: "hachejota",
        password: hashedPassword,
        role: "ADMIN",
        credits: 9999,
        referralCode: generateReferralCode(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "Admin created successfully",
      admin: {
        username: admin.username,
        role: admin.role,
        credits: admin.credits,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
