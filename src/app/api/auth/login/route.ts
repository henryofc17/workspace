import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const username = body.username?.trim().toLowerCase()
    const password = body.password

    if (!username || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    // 👇 COOKIE BIEN CONFIGURADA
    cookies().set("auth-token", user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/"
    })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error("LOGIN ERROR:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
