"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
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

  const widgetId = useRef<any>(null);
  const loadingCaptcha = useRef(false);

  const [username, setUsername] =
    useState("");
  const [password, setPassword] =
    useState("");
  const [captchaToken, setCaptchaToken] =
    useState("");
  const [widgetReady, setWidgetReady] =
    useState(false);
  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    let tries = 0;

    const timer = setInterval(() => {
      tries++;

      if (
        typeof window !== "undefined" &&
        window.turnstile &&
        document.getElementById(
          "cf-turnstile"
        ) &&
        !widgetReady
      ) {
        clearInterval(timer);

        try {
          widgetId.current =
            window.turnstile.render(
              "#cf-turnstile",
              {
                sitekey:
                  process.env
                    .NEXT_PUBLIC_TURNSTILE_SITE_KEY,

                size: "invisible",

                callback: (
                  token: string
                ) => {
                  setCaptchaToken(
                    token
                  );
                },

                "expired-callback":
                  () => {
                    setCaptchaToken(
                      ""
                    );
                  },

                "error-callback":
                  () => {
                    setCaptchaToken(
                      ""
                    );
                  },
              }
            );

          setWidgetReady(true);
        } catch {}
      }

      if (tries >= 30) {
        clearInterval(timer);
      }
    }, 500);

    return () =>
      clearInterval(timer);
  }, [widgetReady]);

  const getCaptchaToken =
    async (): Promise<string> => {
      if (
        !window.turnstile ||
        widgetId.current === null
      ) {
        throw new Error(
          "Captcha no disponible"
        );
      }

      if (loadingCaptcha.current) {
        throw new Error(
          "Captcha ocupado"
        );
      }

      loadingCaptcha.current = true;

      return new Promise(
        (resolve, reject) => {
          try {
            setCaptchaToken("");

            window.turnstile.reset(
              widgetId.current
            );

            window.turnstile.execute(
              widgetId.current
            );

            let tries = 0;

            const checker =
              setInterval(() => {
                tries++;

                const token =
                  (
                    document.querySelector(
                      '[name="cf-turnstile-response"]'
                    ) as HTMLInputElement
                  )?.value ||
                  captchaToken;

                if (
                  token &&
                  token.length >
                    20
                ) {
                  clearInterval(
                    checker
                  );
                  loadingCaptcha.current =
                    false;
                  setCaptchaToken(
                    token
                  );
                  resolve(
                    token
                  );
                }

                if (
                  tries >= 25
                ) {
                  clearInterval(
                    checker
                  );
                  loadingCaptcha.current =
                    false;
                  reject(
                    new Error(
                      "Captcha tardó demasiado"
                    )
                  );
                }
              }, 300);
          } catch {
            loadingCaptcha.current =
              false;

            reject(
              new Error(
                "Error captcha"
              )
            );
          }
        }
      );
    };

  const handleLogin =
    useCallback(
      async () => {
        if (
          !username.trim() ||
          !password.trim()
        ) {
          toast.error(
            "Completa todos los campos"
          );
          return;
        }

        if (loading) return;

        setLoading(true);

        try {
          if (
            !window.turnstile ||
            !widgetReady
          ) {
            throw new Error(
              "Captcha cargando..."
            );
          }

          const token =
            captchaToken ||
            (await getCaptchaToken());

          const res =
            await fetch(
              "/api/auth/login",
              {
                method:
                  "POST",
                headers:
                  {
                    "Content-Type":
                      "application/json",
                  },
                body: JSON.stringify(
                  {
                    username:
                      username.trim(),
                    password,
                    turnstileToken:
                      token,
                  }
                ),
              }
            );

          const data =
            await res.json();

          if (!res.ok) {
            throw new Error(
              data.error ||
                "Login fallido"
            );
          }

          toast.success(
            `Bienvenido ${data.user.username}`
          );

          router.push(
            data.user
              .role ===
              "ADMIN"
              ? "/admin"
              : "/"
          );
        } catch (
          error: any
        ) {
          toast.error(
            error.message ||
              "Error de conexión"
          );
        } finally {
          setLoading(false);
          setCaptchaToken("");

          try {
            if (
              window.turnstile &&
              widgetId.current !==
                null
            ) {
              window.turnstile.reset(
                widgetId.current
              );
            }
          } catch {}
        }
      },
      [
        username,
        password,
        captchaToken,
        widgetReady,
        loading,
        router,
      ]
    );

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="beforeInteractive"
      />

      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-900/30">
              <Shield className="h-8 w-8 text-white" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-white">
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
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <LogIn className="h-4 w-4 text-[#E50914]" />
                Acceso seguro
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              <Input
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                  )
                }
                placeholder="Usuario"
                className="h-11 bg-[#0a0a0a] border-white/10 text-white"
              />

              <Input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                placeholder="Contraseña"
                className="h-11 bg-[#0a0a0a] border-white/10 text-white"
              />

              <div id="cf-turnstile"></div>

              <Button
                onClick={
                  handleLogin
                }
                disabled={
                  loading
                }
                className="w-full h-11 bg-[#E50914] hover:bg-[#b2070f] rounded-xl text-white"
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
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
