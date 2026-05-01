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
    // 1. Test database connection
    try {
      await prisma.$connect()
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      return NextResponse.json(
        { success: false, error: `Database connection failed: ${msg}` },
        { status: 500 }
      )
    }

    // 2. Check if tables exist by trying a simple query
    let userCount = 0
    try {
      userCount = await prisma.user.count()
    } catch {
      return NextResponse.json(
        { success: false, error: "Tables not found. Run 'prisma db push' first or redeploy on Vercel." },
        { status: 500 }
      )
    }

    // 3. Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { username: "hachejota" },
    })

    if (existingAdmin) {
      return NextResponse.json({
        success: true,
        message: "Database OK - Admin already exists",
        stats: {
          totalUsers: userCount,
          admin: {
            username: existingAdmin.username,
            role: existingAdmin.role,
            credits: existingAdmin.credits,
          },
        },
      })
    }

    // 4. Create admin user
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
      message: "Database OK - Admin created successfully",
      stats: {
        totalUsers: userCount + 1,
        admin: {
          username: admin.username,
          role: admin.role,
          credits: admin.credits,
        },
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
