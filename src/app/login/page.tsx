"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
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
    const checkSession = async () => {
      try {
        const res = await fetch(
          "/api/auth/me",
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (res.ok) {
          const data =
            await res.json();

          window.location.replace(
            data.user?.role ===
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

    const timer = setInterval(() => {
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
        clearInterval(timer);

        widgetId.current =
          window.turnstile.render(
            "#cf-turnstile",
            {
              sitekey:
                process.env
                  .NEXT_PUBLIC_TURNSTILE_SITE_KEY,
              size: "invisible",
            }
          );

        setWidgetReady(true);
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
      return new Promise(
        (resolve, reject) => {
          try {
            window.turnstile.reset(
              widgetId.current
            );

            window.turnstile.execute(
              widgetId.current,
              {
                callback: (
                  token: string
                ) =>
                  resolve(token),
              }
            );

            setTimeout(() => {
              reject(
                new Error(
                  "Captcha timeout"
                )
              );
            }, 10000);
          } catch {
            reject(
              new Error(
                "Captcha error"
              )
            );
          }
        }
      );
    };

  const handleLogin =
    useCallback(async () => {
      if (
        !username.trim() ||
        !password.trim()
      ) {
        toast.error(
          "Completa campos"
        );
        return;
      }

      setLoading(true);

      try {
        const token =
          await getCaptchaToken();

        const res = await fetch(
          "/api/auth/login",
          {
            method: "POST",
            credentials:
              "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              username:
                username.trim(),
              password,
              turnstileToken:
                token,
            }),
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error
          );
        }

        toast.success(
          "Bienvenido"
        );

        setTimeout(() => {
          window.location.replace(
            data.user.role ===
              "ADMIN"
              ? "/admin"
              : "/"
          );
        }, 800);
      } catch (e: any) {
        toast.error(
          e.message ||
            "Error login"
        );
      } finally {
        setLoading(false);
      }
    }, [
      username,
      password,
    ]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <Card className="w-full max-w-sm bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex gap-2 items-center">
              <Shield className="w-5 h-5 text-red-500" />
              Login
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Input
              placeholder="Usuario"
              value={username}
              onChange={(e) =>
                setUsername(
                  e.target.value
                )
              }
            />

            <Input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
            />

            <div id="cf-turnstile"></div>

            <Button
              onClick={
                handleLogin
              }
              disabled={loading}
              className="w-full bg-red-600"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Ingresar
                </>
              )}
            </Button>

            <a
              href="https://wa.me/524437863111"
              target="_blank"
              className="w-full flex justify-center bg-green-600 rounded-md py-2 text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              WhatsApp
            </a>

            <a
              href="https://t.me/HcheJotaA_Bot"
              target="_blank"
              className="w-full flex justify-center bg-sky-600 rounded-md py-2 text-white"
            >
              <Send className="w-4 h-4 mr-2" />
              Telegram
            </a>
          </CardContent>
        </Card>
      </div>
    </>
  );
            }
