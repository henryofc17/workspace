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

      if (tries >= 30) {
        clearInterval(timer);
      }
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

      if (!res.ok) {
        throw new Error(data.error || "Login fallido");
      }

      toast.success("Bienvenido");

      setTimeout(() => {
        window.location.replace(data.user.role === "ADMIN" ? "/admin" : "/");
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(99,102,241,0.12),_transparent_28%),linear-gradient(to_bottom,_#050505,_#09090b)]" />
        <div className="absolute left-[-120px] top-[-120px] h-72 w-72 rounded-full bg-red-600/15 blur-3xl" />
        <div className="absolute bottom-[-120px] right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
          <Card className="w-full border border-white/10 bg-zinc-950/80 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl rounded-[28px]">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-[0_0_35px_rgba(239,68,68,0.25)]">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/90 shadow-lg shadow-red-500/30 overflow-hidden">
                    <img
                      src="https://i.ibb.co/x8cY6YVZ/1777494330745.png"
                      alt="logo"
                      className="h-12 w-12 object-contain"
                    />
                  </div>
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

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-inner shadow-black/20">
                <div className="mb-5 flex items-center gap-2 text-lg font-semibold text-white">
                  <ShieldCheck className="h-5 w-5 text-red-500" />
                  Acceso seguro
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">
                      Usuario
                    </label>
                    <Input
                      value={username}
                      placeholder="Usuario"
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      className="h-14 rounded-2xl border-white/10 bg-zinc-950/70 px-4 text-[15px] text-white placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-red-500/60"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        value={password}
                        placeholder="••••••••"
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="h-14 rounded-2xl border-white/10 bg-zinc-950/70 px-4 pr-12 text-[15px] text-white placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-red-500/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((v) => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-white"
                      >
                        {showPass ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div
                      id="cf-turnstile"
                      className="flex min-h-[65px] justify-center"
                    />
                  </div>

                  <Button
                    onClick={handleLogin}
                    disabled={loading}
                    className="h-14 w-full rounded-2xl bg-red-600 text-[15px] font-bold text-white shadow-lg shadow-red-600/25 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Entrando...
                      </>
                    ) : (
                      <>
                        <LogIn className="mr-2 h-5 w-5" />
                        Iniciar sesión
                      </>
                    )}
                  </Button>

                  <p className="pt-1 text-center text-sm text-zinc-500">
                    ¿Necesitas ayuda? Contáctame
                  </p>

                  <div className="grid gap-3">
                    <a
                      href="https://wa.me/524437863111"
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    >
                      <MessageCircle className="h-5 w-5" />
                      WhatsApp
                    </a>

                    <a
                      href="https://t.me/HcheJotaA_Bot"
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-4 text-sm font-semibold text-white transition hover:bg-sky-500"
                    >
                      <Send className="h-5 w-5" />
                      Telegram
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
