"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  LogIn,
  MessageCircle,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

declare global {
  interface Window {
    turnstile: any;
    cfToken: string;
  }
}

export default function LoginPage() {
  const widgetId = useRef<any>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          window.location.replace(
            data.user?.role === "ADMIN" ? "/admin" : "/"
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
        typeof window !== "undefined" &&
        window.turnstile &&
        document.getElementById("cf-turnstile") &&
        !widgetReady
      ) {
        clearInterval(timer);

        try {
          widgetId.current = window.turnstile.render("#cf-turnstile", {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            theme: "dark",
            size: "normal",
            callback: (token: string) => {
              window.cfToken = token;
            },
            "error-callback": () => {
              toast.error("Captcha error");
            },
          });

          setWidgetReady(true);
        } catch {
          toast.error("No cargó captcha");
        }
      }

      if (tries >= 30) clearInterval(timer);
    }, 500);

    return () => clearInterval(timer);
  }, [widgetReady]);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Completa los campos");
      return;
    }

    if (!window.cfToken) {
      toast.error("Completa el captcha");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken: window.cfToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login fallido");

      toast.success("Bienvenido");

      setTimeout(() => {
        window.location.replace(
          data.user.role === "ADMIN" ? "/admin" : "/"
        );
      }, 800);
    } catch (e: any) {
      toast.error(e.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [username, password]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-10 text-white">

        {/* Fondo */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),_transparent_28%),linear-gradient(to_bottom,_#050505,_#09090b)]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">

          <Card className="w-full border border-white/10 bg-zinc-950/80 backdrop-blur-xl rounded-[28px] shadow-[0_20px_80px_rgba(0,0,0,0.6)]">

            <CardContent className="p-6 sm:p-8">

              {/* HEADER */}
              <div className="mb-7 text-center">

                {/* 🔥 LOGO PRO HORIZONTAL */}
                <div className="relative mx-auto mb-8 w-56 h-20 flex items-center justify-center">

                  {/* glow */}
                  <div className="absolute inset-0 bg-red-600/20 blur-3xl opacity-70 animate-pulse"></div>

                  <img
                    src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
                    alt="logo"
                    className="
                      relative
                      w-full
                      h-full
                      object-contain
                      drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]
                      transition-all
                      duration-500
                      hover:scale-105
                      hover:drop-shadow-[0_15px_40px_rgba(239,68,68,0.6)]
                      animate-[fadeIn_0.8s_ease]
                    "
                  />

                </div>

                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                  <Sparkles className="h-3.5 w-3.5 text-red-400" />
                  Acceso privado
                </div>

                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                  Netflix Checker
                </h1>

                <div className="mt-2 text-2xl font-extrabold text-red-500">
                  Pro
                </div>

                <p className="mt-3 text-sm text-zinc-400">
                  Inicia sesión para continuar
                </p>
              </div>

              {/* FORM */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-inner shadow-black/20">

                <div className="mb-5 flex items-center gap-2 text-lg font-semibold">
                  <ShieldCheck className="h-5 w-5 text-red-500" />
                  Acceso seguro
                </div>

                <div className="space-y-5">

                  <Input
                    value={username}
                    placeholder="Usuario"
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 rounded-2xl bg-zinc-950/70 border-white/10 text-white"
                  />

                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      value={password}
                      placeholder="••••••••"
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-14 rounded-2xl bg-zinc-950/70 border-white/10 text-white pr-12"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400"
                    >
                      {showPass ? <EyeOff /> : <Eye />}
                    </button>
                  </div>

                  <div id="cf-turnstile" className="flex justify-center min-h-[65px]" />

                  <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="h-14 w-full rounded-2xl bg-red-600 hover:bg-red-500 font-bold"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2" />
                        Iniciar sesión
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-zinc-500">
                    ¿Necesitas ayuda? Contáctame
                  </p>

                  <a
                    href="https://wa.me/524437863111"
                    target="_blank"
                    className="flex justify-center items-center gap-2 bg-green-600 hover:bg-green-500 rounded-2xl py-3"
                  >
                    <MessageCircle /> WhatsApp
                  </a>

                  <a
                    href="https://t.me/HcheJotaA_Bot"
                    target="_blank"
                    className="flex justify-center items-center gap-2 bg-sky-600 hover:bg-sky-500 rounded-2xl py-3"
                  >
                    <Send /> Telegram
                  </a>

                </div>
              </div>

            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
                }
