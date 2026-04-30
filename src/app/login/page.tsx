
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
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import {
Loader2,
LogIn,
MessageCircle,
Send,
Eye,
EyeOff,
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
        data.user?.role === "ADMIN"
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
    typeof window !== "undefined" &&
    window.turnstile &&
    document.getElementById("cf-turnstile") &&
    !widgetReady
  ) {
    clearInterval(timer);

    try {
      widgetId.current = window.turnstile.render(
        "#cf-turnstile",
        {
          sitekey:
            process.env
              .NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "dark",
          size: "normal",

          callback: (token: string) => {
            window.cfToken = token;
          },

          "error-callback": () => {
            toast.error("Captcha error");
          },
        }
      );

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
toast.error("Completa campos");
return;
}

if (!window.cfToken) {
  toast.error("Completa captcha");
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
    throw new Error(
      data.error || "Login fallido"
    );
  }

  toast.success("Bienvenido");

  setTimeout(() => {
    window.location.replace(
      data.user.role === "ADMIN"
        ? "/admin"
        : "/"
    );
  }, 800);
} catch (e: any) {
  toast.error(
    e.message || "Error de conexión"
  );
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

  <div className="min-h-screen bg-black flex items-center justify-center px-4">

    <Card className="w-full max-w-md bg-zinc-950 border-zinc-800 rounded-3xl shadow-2xl">

      <CardContent className="p-7 space-y-6">

        <div className="text-center space-y-3">

          {/* 🔥 LOGO EXTERNO */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/30 overflow-hidden">
            <img
              src="https://i.ibb.co/x8cY6YVZ/1777494330745.png"
              alt="logo"
              className="w-12 h-12 object-contain"
            />
          </div>

          <h1 className="text-4xl font-bold text-white">
            Netflix Checker{" "}
            <span className="text-red-500">
              Pro
            </span>
          </h1>

          <p className="text-zinc-400 text-sm">
            Inicia sesión para continuar
          </p>

        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">

          <div className="flex items-center gap-2 text-white font-semibold text-xl">
            <LogIn className="w-5 h-5 text-red-500" />
            Acceso seguro
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 text-sm">
              Usuario
            </label>

            <Input
              value={username}
              placeholder="Usuario"
              onChange={(e) =>
                setUsername(e.target.value)
              }
              className="h-14 bg-zinc-950 border-zinc-700 text-white text-xl rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-zinc-400 text-sm">
              Contraseña
            </label>

            <div className="relative">

              <Input
                type={showPass ? "text" : "password"}
                value={password}
                placeholder="••••••••"
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="h-14 bg-zinc-950 border-zinc-700 text-white text-xl rounded-xl pr-12"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPass(!showPass)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400"
              >
                {showPass ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>

            </div>
          </div>

          <div
            id="cf-turnstile"
            className="flex justify-center min-h-[65px]"
          />

          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-xl rounded-2xl font-bold"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </Button>

          <p className="text-center text-zinc-500 text-sm">
            ¿Necesitas ayuda? Contáctame
          </p>

          <a
            href="https://wa.me/524437863111"
            target="_blank"
            className="w-full flex justify-center items-center gap-2 bg-green-600 hover:bg-green-700 rounded-2xl py-4 text-white text-xl font-semibold"
          >
            <MessageCircle className="w-5 h-5" />
            WhatsApp
          </a>

          <a
            href="https://t.me/HcheJotaA_Bot"
            target="_blank"
            className="w-full flex justify-center items-center gap-2 bg-sky-600 hover:bg-sky-700 rounded-2xl py-4 text-white text-xl font-semibold"
          >
            <Send className="w-5 h-5" />
            Telegram
          </a>

        </div>

      </CardContent>
    </Card>

  </div>
</>

);
}
