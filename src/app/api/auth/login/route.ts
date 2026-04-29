import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createToken } from "@/lib/auth";
import { loginRatelimit } from "@/lib/ratelimit";

async function verifyTurnstile(
  token: string,
  ip: string
) {
  try {
    const form = new FormData();

    form.append(
      "secret",
      process.env.TURNSTILE_SECRET_KEY || ""
    );

    form.append("response", token);

    if (ip && ip !== "unknown") {
      form.append("remoteip", ip);
    }

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: form,
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return { success: false };
    }

    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const ip =
      request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // RATE LIMIT
    try {
      const rate =
        await loginRatelimit.limit(ip);

      if (!rate.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Demasiados intentos. Espera unos minutos.",
          },
          { status: 429 }
        );
      }
    } catch {}

    const body = await request.json();

    const username =
      body.username?.trim() || "";

    const password =
      body.password || "";

    const captchaToken =
      body.turnstileToken || "";

    // VALIDACIONES
    if (!username || !password) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Usuario y contraseña requeridos",
        },
        { status: 400 }
      );
    }

    if (!captchaToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Captcha requerido",
        },
        { status: 400 }
      );
    }

    // CAPTCHA
    const captcha =
      await verifyTurnstile(
        captchaToken,
        ip
      );

    if (!captcha.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Captcha inválido",
        },
        { status: 400 }
      );
    }

    // USER
    const user =
      await prisma.user.findUnique({
        where: {
          username: username,
        },
      });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Credenciales incorrectas",
        },
        { status: 401 }
      );
    }

    // PASSWORD
    const valid =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Credenciales incorrectas",
        },
        { status: 401 }
      );
    }

    // TOKEN
    const token =
      await createToken({
        userId: user.id,
        username:
          user.username,
        role: user.role,
      });

    const response =
      NextResponse.json({
        success: true,
        user: {
          id: user.id,
          username:
            user.username,
          role: user.role,
          credits:
            user.credits,
        },
      });

    response.cookies.set(
      "auth-token",
      token,
      {
        httpOnly: true,
        secure:
          process.env
            .NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge:
          60 *
          60 *
          24 *
          7,
      }
    );

    return response;
  } catch (err: any) {
    console.error(
      "LOGIN ERROR:",
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Error del servidor",
      },
      { status: 500 }
    );
  }
}
