import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { loginRatelimit } from "@/lib/ratelimit";

async function verifyTurnstile(token: string, ip: string) {
  const form = new FormData();

  form.append("secret", process.env.TURNSTILE_SECRET_KEY || "");
  form.append("response", token);
  form.append("remoteip", ip);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: form,
    }
  );

  return await res.json();
}

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";

    // RATE LIMIT
    const { success } = await loginRatelimit.limit(ip);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: "Demasiados intentos. Espera 10 minutos.",
        },
        { status: 429 }
      );
    }

    const {
      username,
      password,
      turnstileToken: captchaToken,
    } = await request.json();

    // VALIDACIONES
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Usuario y contraseña requeridos",
        },
        { status: 400 }
      );
    }

    if (!captchaToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Completa la verificación",
        },
        { status: 400 }
      );
    }

    // VERIFICAR TURNSTILE
    const captcha = await verifyTurnstile(captchaToken, ip);

    if (!captcha.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Captcha inválido",
        },
        { status: 400 }
      );
    }

    // BUSCAR USUARIO
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenciales incorrectas",
        },
        { status: 401 }
      );
    }

    // VALIDAR PASSWORD
    const valid = await bcrypt.compare(
      password,
      user.password
    );

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Credenciales incorrectas",
        },
        { status: 401 }
      );
    }

    // CREAR TOKEN
    const token = await createToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        credits: user.credits,
      },
    });

    response.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);

    return NextResponse.json(
      {
        success: false,
        error: "Error del servidor",
      },
      { status: 500 }
    );
  }
}
