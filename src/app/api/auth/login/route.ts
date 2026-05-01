import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { createToken } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const username = body.username?.trim()
    const password = body.password

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    // Check database connection
    try {
      await prisma.$connect()
    } catch (dbErr) {
      console.error("DB CONNECTION ERROR:", dbErr)
      return NextResponse.json(
        { error: "Database connection failed. Check DATABASE_URL." },
        { status: 500 }
      )
    }

    // Case-insensitive user lookup
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } }
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // Generate JWT token
    const token = await createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    })

    const cookieStore = await cookies()
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/"
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
      },
    })

  } catch (err) {
    console.error("LOGIN ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
