"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Script from "next/script";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, User, Lock, Gift, ArrowRight, Eye, EyeOff, Zap, Users, ChevronRight, ShieldCheck } from "lucide-react";

declare global {
  interface Window {
    turnstile: any;
    cfToken: string;
  }
}

function generateFingerprint(): string {
  try {
    const nav = navigator as any;
    const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const lang = nav.language || "";
    const platform = nav.platform || "";
    const ua = nav.userAgent.substring(0, 100);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    return btoa(`${platform}|${screen}|${lang}|${tz}|${ua}`).substring(0, 64);
  } catch {
    return "";
  }
}

function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-30 pointer-events-none ${className}`}
      animate={{
        y: [0, -30, 0, 20, 0],
        x: [0, 15, -10, 20, 0],
        scale: [1, 1.1, 0.95, 1.05, 1],
      }}
      transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

function FeaturePill({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-gray-400">
      <Icon className="h-3 w-3 text-[#E50914]" />
      {text}
    </div>
  );
}

function PremiumInput({
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  showPassword,
  onTogglePassword,
}: {
  icon: React.ElementType;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  showPassword?: boolean;
  onTogglePassword?: () => void;
}) {
  return (
    <div className="relative group">
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 transition-colors text-gray-500 group-focus-within:text-[#E50914]">
        <Icon className="h-4 w-4" />
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-12 pl-11 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder:text-gray-600 outline-none transition-all duration-300 focus:bg-white/[0.06] focus:border-[#E50914]/40 focus:ring-2 focus:ring-[#E50914]/10 hover:border-white/[0.15]"
      />
      {onTogglePassword && (
        <button
          type="button"
          onClick={onTogglePassword}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function SlideTabs({ tab, setTab }: { tab: "login" | "register"; setTab: (t: "login" | "register") => void }) {
  return (
    <div className="relative flex bg-white/[0.04] rounded-2xl p-1 border border-white/[0.06]">
      <motion.div
        className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-[#E50914] to-[#B2070F] shadow-lg shadow-[#E50914]/20"
        animate={{ left: tab === "login" ? "4px" : "50%", width: "calc(50% - 4px)" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
      <button
        onClick={() => setTab("login")}
        className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
          tab === "login" ? "text-white" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        Iniciar Sesion
      </button>
      <button
        onClick={() => setTab("register")}
        className={`relative z-10 flex-1 py-2.5 text-sm font-medium rounded-xl transition-colors duration-200 ${
          tab === "register" ? "text-white" : "text-gray-500 hover:text-gray-300"
        }`}
      >
        Registrarse
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const widgetId = useRef<any>(null);

  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [siteConfig, setSiteConfig] = useState({ REGISTER_BONUS: 3, REFERRAL_BONUS: 5, WHATSAPP_LINK: "", WHATSAPP_VISIBLE: true });

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regReferral, setRegReferral] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [widgetReady, setWidgetReady] = useState(false);
  const [regWidgetId, setRegWidgetId] = useState<any>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.config) {
          setSiteConfig({
            REGISTER_BONUS: d.config.REGISTER_BONUS ?? 3,
            REFERRAL_BONUS: d.config.REFERRAL_BONUS ?? 5,
            WHATSAPP_LINK: d.config.WHATSAPP_LINK ?? "",
            WHATSAPP_VISIBLE: d.config.WHATSAPP_VISIBLE ?? true,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.turnstile && document.getElementById("cf-turnstile") && !widgetReady) {
        clearInterval(t);
        widgetId.current = window.turnstile.render("#cf-turnstile", {
          sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => { window.cfToken = token; },
        });
        setWidgetReady(true);
      }
      if (tries >= 30) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [widgetReady]);

  // Render register turnstile when switching to register tab
  useEffect(() => {
    if (tab !== "register") return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.turnstile && document.getElementById("cf-turnstile-register")) {
        clearInterval(t);
        const el = document.getElementById("cf-turnstile-register");
        if (el && el.children.length === 0) {
          const id = window.turnstile.render("#cf-turnstile-register", {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
            theme: "dark",
            callback: (token: string) => { window.cfToken = token; },
          });
          setRegWidgetId(id);
        }
      }
      if (tries >= 30) clearInterval(t);
    }, 300);
    return () => clearInterval(t);
  }, [tab]);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) { toast.error("Completa todos los campos"); return; }
    if (!window.cfToken) { toast.error("Completa el captcha"); return; }
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, turnstileToken: window.cfToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Credenciales incorrectas");
        if (widgetId.current && window.turnstile) { window.turnstile.reset(widgetId.current); window.cfToken = ""; }
        return;
      }
      toast.success(`Bienvenido, ${data.user.username}`);
      router.replace(data.user.role === "ADMIN" ? "/admin" : "/");
    } catch { toast.error("Error de conexion"); }
    finally { setLoginLoading(false); }
  }, [username, password, router]);

  const handleRegister = useCallback(async () => {
    if (!regUsername.trim() || !regPassword.trim()) { toast.error("Completa usuario y contrasena"); return; }
    if (!window.cfToken) { toast.error("Completa la verificacion"); return; }
    setRegLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: regUsername.trim(), password: regPassword, referralCode: regReferral || undefined, fingerprint: generateFingerprint(), turnstileToken: window.cfToken }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al registrarse"); return; }
      toast.success("Cuenta creada, ahora inicia sesion");
      setTab("login"); setRegUsername(""); setRegPassword(""); setRegReferral("");
      if (regWidgetId && window.turnstile) { window.turnstile.reset(regWidgetId); window.cfToken = ""; }
    } catch { toast.error("Error de conexion"); }
    finally { setRegLoading(false); }
  }, [regUsername, regPassword, regReferral]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />

      <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#050505]">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(229,9,20,0.15),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(229,9,20,0.08),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_40%_at_10%_90%,rgba(139,92,246,0.06),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,black_30%,transparent_80%)]" />
          <FloatingOrb className="w-96 h-96 bg-[#E50914]/20 -top-48 -left-48" delay={0} />
          <FloatingOrb className="w-72 h-72 bg-[#E50914]/10 bottom-0 right-0" delay={5} />
          <FloatingOrb className="w-56 h-56 bg-purple-500/10 top-1/3 right-1/4" delay={10} />
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 w-full max-w-[420px] px-4"
        >
          {/* Brand Header */}
          <div className="text-center mb-8">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="relative inline-flex mb-5"
            >
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#E50914]/20 to-transparent blur-xl" />
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-[#E50914]/20">
                <Image
                  src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
                  alt="Netflix Checker Pro"
                  width={200}
                  height={64}
                  className="h-16 w-auto object-contain"
                  unoptimized
                />
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-extrabold text-white tracking-tight"
            >
              Netflix Checker
              <span className="bg-gradient-to-r from-[#E50914] to-[#FF6B6B] bg-clip-text text-transparent"> Pro</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-gray-500 text-sm mt-2"
            >
              Verifica, genera y administra cookies de Netflix
            </motion.p>
          </div>

          {/* Feature Pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-2 mb-6 flex-wrap"
          >
            <FeaturePill icon={Zap} text="Checker Gratis" />
            <FeaturePill icon={Gift} text={`+${siteConfig.REGISTER_BONUS} Creditos`} />
            <FeaturePill icon={Users} text="Referidos" />
          </motion.div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative"
          >
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-b from-white/[0.08] to-white/[0.02]" />
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-t from-[#E50914]/5 to-transparent" />
            <div className="relative rounded-3xl bg-[#0D0D0D]/90 backdrop-blur-2xl border border-white/[0.06] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
              <div className="relative p-6 sm:p-8 space-y-6">
                <SlideTabs tab={tab} setTab={setTab} />

                <AnimatePresence mode="wait">
                  {tab === "login" ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <PremiumInput icon={User} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" />
                      <PremiumInput
                        icon={Lock}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña"
                        showPassword={showPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                      />

                      {/* Turnstile */}
                      <div id="cf-turnstile" className="flex justify-center" />

                      {/* Login Button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleLogin}
                        disabled={loginLoading}
                        className="relative w-full h-12 rounded-xl font-semibold text-white text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-[#E50914] to-[#B2070F] group-hover:from-[#FF1A25] group-hover:to-[#E50914] transition-all duration-300" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
                        <div className="relative flex items-center justify-center gap-2">
                          {loginLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Iniciar Sesion
                              <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                            </>
                          )}
                        </div>
                      </motion.button>

                      {/* Status Bar */}
                      <div className="flex items-center justify-center gap-2 py-1">
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-600">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/70" />
                          <span>Sistema protegido y optimizado</span>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-4"
                    >
                      <PremiumInput icon={User} value={regUsername} onChange={(e) => setRegUsername(e.target.value)} placeholder="Usuario" />
                      <PremiumInput
                        icon={Lock}
                        type={showRegPassword ? "text" : "password"}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Contrasena"
                        showPassword={showRegPassword}
                        onTogglePassword={() => setShowRegPassword(!showRegPassword)}
                      />
                      <PremiumInput icon={Gift} value={regReferral} onChange={(e) => setRegReferral(e.target.value)} placeholder="Codigo referido (opcional)" />

                      {/* Turnstile for Register */}
                      <div id="cf-turnstile-register" className="flex justify-center" />

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-yellow-500/[0.05] border border-yellow-500/10"
                      >
                        <Gift className="h-4 w-4 text-yellow-500/70 shrink-0" />
                        <p className="text-[11px] text-yellow-500/60 leading-relaxed">
                          Obten <span className="text-yellow-400 font-semibold">+{siteConfig.REGISTER_BONUS} creditos gratis</span> al registrarte.
                          Usa un codigo de referido para ganar <span className="text-yellow-400 font-semibold">+{siteConfig.REFERRAL_BONUS} creditos extra</span> a tu amigo.
                        </p>
                      </motion.div>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRegister}
                        disabled={regLoading}
                        className="relative w-full h-12 rounded-xl font-semibold text-white text-sm overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-emerald-500 group-hover:from-emerald-500 group-hover:to-emerald-400 transition-all duration-300" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
                        <div className="relative flex items-center justify-center gap-2">
                          {regLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Crear Cuenta
                              <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                            </>
                          )}
                        </div>
                      </motion.button>

                      <p className="text-center text-[11px] text-gray-600">
                        Ya tienes cuenta?{" "}
                        <button onClick={() => setTab("login")} className="text-[#E50914]/80 hover:text-[#E50914] font-medium transition-colors cursor-pointer">
                          Inicia sesion
                        </button>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 space-y-3"
          >
            <p className="text-[11px] text-gray-700">
              Desarrollado por{" "}
              <span className="text-gray-400 font-semibold">HacheJota</span>
            </p>
            <div className="flex items-center justify-center gap-4">
              {siteConfig.WHATSAPP_VISIBLE && siteConfig.WHATSAPP_LINK && (
              <a href={siteConfig.WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-emerald-400 transition-colors" title="Grupo de WhatsApp">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              )}
              <a href="https://wa.me/524437863111" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 transition-colors" title="Soporte">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </a>
              <a href="https://t.me/HcheJotaA_Bot" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-400 transition-colors" title="Telegram">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
            </div>
          </motion.div>
        </motion.div>

        <style jsx global>{`
          * { scrollbar-width: thin; scrollbar-color: #222 transparent; }
          *::-webkit-scrollbar { width: 6px; }
          *::-webkit-scrollbar-track { background: transparent; }
          *::-webkit-scrollbar-thumb { background: #222; border-radius: 3px; }
        `}</style>
      </div>
    </>
  );
}
