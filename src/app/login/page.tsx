"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  LogIn,
  MessageCircle,
  Send,
} from "lucide-react";

declare global {
  interface Window {
    turnstile: any;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      if (
        typeof window !== "undefined" &&
        window.turnstile &&
        document.getElementById("cf-turnstile") &&
        !widgetReady
      ) {
        clearInterval(timer);

        try {
          window.turnstile.render("#cf-turnstile", {
            sitekey:
              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            size: "invisible",

            callback: (token: string) => {
              setCaptchaToken(token);
            },

            "expired-callback": () => {
              setCaptchaToken("");
            },

            "error-callback": () => {
              setCaptchaToken("");
            },
          });

          setWidgetReady(true);
        } catch (error) {}
      }
    }, 400);

    return () => clearInterval(timer);
  }, [widgetReady]);

  const waitForCaptchaLoad = async () => {
    for (let i = 0; i < 10; i++) {
      if (window.turnstile) return true;

      await new Promise((r) =>
        setTimeout(r, 500)
      );
    }

    return false;
  };

  const getInvisibleToken = async () => {
    return new Promise<string>((resolve, reject) => {
      let tries = 0;

      window.turnstile.reset("#cf-turnstile");
      window.turnstile.execute("#cf-turnstile");

      const check = setInterval(() => {
        tries++;

        if (captchaToken) {
          clearInterval(check);
          resolve(captchaToken);
        }

        if (tries >= 20) {
          clearInterval(check);
          reject();
        }
      }, 300);
    });
  };

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Completa todos los campos");
      return;
    }

    setLoading(true);

    try {
      if (!window.turnstile || !widgetReady) {
        toast.loading("Cargando...");

        const loaded =
          await waitForCaptchaLoad();

        toast.dismiss();

        if (!loaded) {
          toast.error(
            "No cargó."
          );
          setLoading(false);
          return;
        }
      }

      let token = captchaToken;

      if (!token) {
        token = await getInvisibleToken();
      }

      const res = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            username:
              username.trim(),
            password,
            turnstileToken: token,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        toast.error(
          data.error ||
            "Error al iniciar sesión"
        );

        setCaptchaToken("");

        if (window.turnstile) {
          window.turnstile.reset(
            "#cf-turnstile"
          );
        }

        return;
      }

      toast.success(
        `Bienvenido, ${data.user.username}`
      );

      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch (error) {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [
    username,
    password,
    captchaToken,
    widgetReady,
    router,
  ]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-900/30">
              <Shield className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Netflix Checker
                <span className="text-[#E50914] ml-1">
                  Pro
                </span>
              </h1>

              <p className="text-sm text-gray-400">
                Inicia sesión para continuar
              </p>
            </div>
          </div>

          <Card className="border-white/10 bg-[#171717] rounded-2xl shadow-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <LogIn className="h-4 w-4 text-[#E50914]" />
                Acceso seguro
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400">
                  Usuario
                </label>

                <Input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  placeholder="Tu usuario"
                  className="h-11 bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400">
                  Contraseña
                </label>

                <Input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  placeholder="Tu contraseña"
                  className="h-11 bg-[#0a0a0a] border-white/10 text-white"
                />
              </div>

              <div id="cf-turnstile"></div>

              <Button
                onClick={handleLogin}
                disabled={loading}
                className="w-full h-11 bg-[#E50914] hover:bg-[#b2070f] text-white rounded-xl"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  "Iniciar Sesión"
                )}
              </Button>

              <p className="text-center text-xs text-gray-500">
                ¿Necesitas ayuda? Contáctame
              </p>

              <div className="space-y-3">
                <a
                  href="https://wa.me/524437863111"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-green-600 text-white"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>

                <a
                  href="https://t.me/HcheJotaA_Bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-sky-600 text-white"
                >
                  <Send className="h-4 w-4" />
                  Telegram
                </a>
              </div>
            </CardContent>
          </Card>

          <p className="text-center text-[10px] text-gray-700">
            Netflix Cookie Checker Pro
          </p>
        </div>
      </div>
    </>
  );
}
