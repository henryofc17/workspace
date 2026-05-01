"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Loader2,
  LogIn,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  Gift,
} from "lucide-react";

declare global {
  interface Window {
    turnstile: any;
    cfToken: string;
  }
}

// fingerprint anti multi cuenta
function generateFingerprint(): string {
  try {
    const nav = navigator as any;
    const scr = `${screen.width}x${screen.height}x${screen.colorDepth}`;
    const lang = nav.language || "";
    const platform = nav.platform || "";
    const ua = nav.userAgent.substring(0, 80);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return btoa(`${platform}|${scr}|${lang}|${tz}|${ua}`).substring(0, 64);
  } catch {
    return "";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const widgetId = useRef<any>(null);

  const [tab, setTab] = useState<"login" | "register">("login");

  // login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // register
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regReferral, setRegReferral] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [widgetReady, setWidgetReady] = useState(false);

  // auto redirect si ya logueado
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          router.push(d.user.role === "ADMIN" ? "/admin" : "/");
        }
      })
      .catch(() => {});
  }, [router]);

  // turnstile init
  useEffect(() => {
    let tries = 0;

    const t = setInterval(() => {
      tries++;

      if (window.turnstile && document.getElementById("cf-turnstile") && !widgetReady) {
        clearInterval(t);

        widgetId.current = window.turnstile.render("#cf-turnstile", {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => {
            window.cfToken = token;
          },
        });

        setWidgetReady(true);
      }

      if (tries >= 30) clearInterval(t);
    }, 500);

    return () => clearInterval(t);
  }, [widgetReady]);

  // LOGIN
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          turnstileToken: window.cfToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success("Bienvenido");

      router.push(data.user.role === "ADMIN" ? "/admin" : "/");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }, [username, password, router]);

  // REGISTER
  const handleRegister = useCallback(async () => {
    if (!regUsername.trim() || !regPassword.trim()) {
      toast.error("Completa campos");
      return;
    }

    setRegLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
          referralCode: regReferral || undefined,
          fingerprint: generateFingerprint(),
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      toast.success("Cuenta creada");

      router.push("/");
    } catch (e: any) {
      toast.error(e.message || "Error");
    } finally {
      setRegLoading(false);
    }
  }, [regUsername, regPassword, regReferral, router]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />

      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
        <div className="w-full max-w-sm space-y-6">

          {/* HEADER */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">
              Netflix Checker <span className="text-red-500">Pro</span>
            </h1>
          </div>

          {/* TABS */}
          <div className="flex bg-[#1F1F1F] p-1 rounded-lg border border-white/10">
            <button onClick={() => setTab("login")} className={`flex-1 py-2 ${tab==="login"?"bg-red-600 text-white":"text-gray-400"}`}>
              Login
            </button>
            <button onClick={() => setTab("register")} className={`flex-1 py-2 ${tab==="register"?"bg-red-600 text-white":"text-gray-400"}`}>
              Register
            </button>
          </div>

          {/* LOGIN */}
          {tab === "login" && (
            <Card className="bg-[#1F1F1F] border-white/10">
              <CardContent className="space-y-4 pt-6">

                <Input placeholder="Usuario" value={username} onChange={(e)=>setUsername(e.target.value)} />

                <div className="relative">
                  <Input
                    type={showPass?"text":"password"}
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                  />
                  <button
                    onClick={()=>setShowPass(!showPass)}
                    className="absolute right-3 top-3 text-gray-400"
                  >
                    {showPass ? <EyeOff/> : <Eye/>}
                  </button>
                </div>

                <div id="cf-turnstile" className="flex justify-center" />

                <Button onClick={handleLogin} disabled={loading} className="w-full bg-red-600">
                  {loading ? <Loader2 className="animate-spin"/> : "Entrar"}
                </Button>

              </CardContent>
            </Card>
          )}

          {/* REGISTER */}
          {tab === "register" && (
            <Card className="bg-[#1F1F1F] border-white/10">
              <CardContent className="space-y-4 pt-6">

                <Input placeholder="Usuario" value={regUsername} onChange={(e)=>setRegUsername(e.target.value)} />

                <Input type="password" placeholder="Contraseña" value={regPassword} onChange={(e)=>setRegPassword(e.target.value)} />

                <Input placeholder="Código (opcional)" value={regReferral} onChange={(e)=>setRegReferral(e.target.value)} />

                <Button onClick={handleRegister} disabled={regLoading} className="w-full bg-green-600">
                  {regLoading ? <Loader2 className="animate-spin"/> : "Crear cuenta"}
                </Button>

              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </>
  );
}
