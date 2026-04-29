"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";

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
  const widgetId = useRef<any>(null);

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [widgetReady, setWidgetReady] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    const checkSession =
      async () => {
        try {
          const res =
            await fetch(
              "/api/auth/me",
              {
                credentials:
                  "include",
                cache:
                  "no-store",
              }
            );

          if (res.ok) {
            const data =
              await res.json();

            window.location.replace(
              data.user
                ?.role ===
                "ADMIN"
                ? "/admin"
                : "/"
            );
          }
        } catch {}
      };

    checkSession();
  }, []);

  useEffect(() => {
    let tries = 0;

    const timer =
      setInterval(() => {
        tries++;

        if (
          typeof window !==
            "undefined" &&
          window.turnstile &&
          document.getElementById(
            "cf-turnstile"
          ) &&
          !widgetReady
        ) {
          clearInterval(
            timer
          );

          try {
            widgetId.current =
              window.turnstile.render(
                "#cf-turnstile",
                {
                  sitekey:
                    process.env
                      .NEXT_PUBLIC_TURNSTILE_SITE_KEY,

                  size:
                    "invisible",

                  callback:
                    () => {},

                  "error-callback":
                    () => {
                      toast.error(
                        "Captcha error"
                      );
                    },
                }
              );

            setWidgetReady(
              true
            );
          } catch {}
        }

        if (
          tries >= 30
        ) {
          clearInterval(
            timer
          );
        }
      }, 500);

    return () =>
      clearInterval(
        timer
      );
  }, [widgetReady]);

  const getCaptchaToken =
    async (): Promise<string> => {
      return new Promise(
        (
          resolve,
          reject
        ) => {
          try {
            window.turnstile.reset(
              widgetId.current
            );

            window.turnstile.execute(
              widgetId.current,
              {
                callback: (
                  token: string
                ) => {
                  resolve(
                    token
                  );
                },
              }
            );

            setTimeout(
              () =>
                reject(
                  new Error(
                    "Captcha timeout"
                  )
                ),
              10000
            );
          } catch {
            reject(
              new Error(
                "Captcha no disponible"
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

        if (loading)
          return;

        setLoading(
          true
        );

        try {
          if (
            !widgetReady
          ) {
            throw new Error(
              "Captcha cargando..."
            );
          }

          const token =
            await getCaptchaToken();

          const res =
            await fetch(
              "/api/auth/login",
              {
                method:
                  "POST",
                credentials:
                  "include",
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

          setTimeout(
            () => {
              window.location.replace(
                data.user
                  .role ===
                  "ADMIN"
                  ? "/admin"
                  : "/"
              );
            },
            800
          );
        } catch (
          error: any
        ) {
          toast.error(
            error.message ||
              "Error"
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        username,
        password,
        widgetReady,
        loading,
      ]
    );

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>

            <div>
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

          <Card className="border-white/10 bg-[#171717] rounded-2xl">
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
              />

              <div id="cf-turnstile"></div>

              <Button
                onClick={
                  handleLogin
                }
                disabled={
                  loading
                }
                className="w-full h-11 bg-[#E50914]"
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
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-green-600 text-white"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>

              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
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
