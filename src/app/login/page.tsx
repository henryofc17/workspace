"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

declare global {
interface Window {
turnstile: any;
cfToken: string;
}
}

function generateFingerprint(): string {
try {
const nav = navigator as any;
const screen = "${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}";
const lang = nav.language || "";
const platform = nav.platform || "";
const ua = nav.userAgent.substring(0, 100);
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
return btoa("${platform}|${screen}|${lang}|${tz}|${ua}").substring(0, 64);
} catch {
return "";
}
}

export default function LoginPage() {
const router = useRouter();
const widgetId = useRef<any>(null);

const [tab, setTab] = useState<"login" | "register">("login");

const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [loginLoading, setLoginLoading] = useState(false);

const [regUsername, setRegUsername] = useState("");
const [regPassword, setRegPassword] = useState("");
const [regReferral, setRegReferral] = useState("");
const [regLoading, setRegLoading] = useState(false);

const [widgetReady, setWidgetReady] = useState(false);

// INIT TURNSTILE
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
toast.error("Completa todos los campos");
return;
}

if (!window.cfToken) {
  toast.error("Completa el captcha");
  return;
}

setLoginLoading(true);

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

  if (!res.ok) {
    toast.error(data.error || "Credenciales incorrectas");

    // 🔥 RESET CAPTCHA
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      window.cfToken = "";
    }

    return;
  }

  toast.success(`Bienvenido, ${data.user.username}`);

  // 🔥 REDIRECCIÓN LIMPIA
  router.replace(data.user.role === "ADMIN" ? "/admin" : "/");

} catch {
  toast.error("Error de conexión");
} finally {
  setLoginLoading(false);
}

}, [username, password, router]);

// REGISTER
const handleRegister = useCallback(async () => {
if (!regUsername.trim() || !regPassword.trim()) {
toast.error("Completa usuario y contraseña");
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

  if (!res.ok) {
    toast.error(data.error || "Error al registrarse");
    return;
  }

  // 🔥 FIX: NO REDIRIGIR A /
  toast.success("Cuenta creada, ahora inicia sesión");

  setTab("login");
  setRegUsername("");
  setRegPassword("");
  setRegReferral("");

} catch {
  toast.error("Error de conexión");
} finally {
  setRegLoading(false);
}

}, [regUsername, regPassword, regReferral]);

return (
<>
<Script
src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
strategy="afterInteractive"
/>

  <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
    <div className="w-full max-w-sm space-y-6">

      <div className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          Netflix Checker <span className="text-[#E50914]">Pro</span>
        </h1>
      </div>

      <div className="flex bg-[#1F1F1F] p-1 rounded-lg border border-white/10">
        <button onClick={() => setTab("login")} className={`flex-1 py-2 ${tab==="login"?"bg-[#E50914] text-white":"text-gray-400"}`}>
          Iniciar Sesión
        </button>
        <button onClick={() => setTab("register")} className={`flex-1 py-2 ${tab==="register"?"bg-[#E50914] text-white":"text-gray-400"}`}>
          Registrarse
        </button>
      </div>

      {tab === "login" && (
        <Card className="bg-[#1F1F1F] border-white/10">
          <CardContent className="space-y-4 pt-6">

            <Input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Usuario" />
            <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Contraseña" />

            <div id="cf-turnstile" className="flex justify-center" />

            <Button onClick={handleLogin} disabled={loginLoading} className="w-full bg-[#E50914]">
              {loginLoading ? <Loader2 className="animate-spin"/> : "Iniciar Sesión"}
            </Button>

          </CardContent>
        </Card>
      )}

      {tab === "register" && (
        <Card className="bg-[#1F1F1F] border-white/10">
          <CardContent className="space-y-4 pt-6">

            <Input value={regUsername} onChange={(e)=>setRegUsername(e.target.value)} placeholder="Usuario" />
            <Input type="password" value={regPassword} onChange={(e)=>setRegPassword(e.target.value)} placeholder="Contraseña" />
            <Input value={regReferral} onChange={(e)=>setRegReferral(e.target.value)} placeholder="Código referido" />

            <Button onClick={handleRegister} disabled={regLoading} className="w-full bg-green-600">
              {regLoading ? <Loader2 className="animate-spin"/> : "Crear Cuenta"}
            </Button>

          </CardContent>
        </Card>
      )}

    </div>
  </div>
</>

);
}
