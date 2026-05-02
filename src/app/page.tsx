"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield,
  Search,
  Zap,
  LogOut,
  Coins,
  Loader2,
  Check,
  ExternalLink,
  CreditCard,
  Clock,
  TrendingDown,
  Globe,
  Tv,
  Mail,
  X,
  Calendar,
  Gift,
  Share2,
  RefreshCw,
  RotateCcw,
  Trash2,
  MonitorPlay,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NetflixMetadata {
  country?: string;
  countryName?: string;
  plan?: string;
  price?: string;
  currency?: string;
  videoQuality?: string;
  maxStreams?: number;
  status?: string;
  memberSince?: string;
  nextBilling?: string;
  email?: string;
  phone?: string;
  paymentMethod?: string;
  profiles?: string;
  devices?: string;
}

interface CheckerResult {
  success: boolean;
  token?: string;
  link?: string;
  metadata?: NetflixMetadata;
  error?: string;
}

interface Transaction {
  id: string;
  type: string;
  credits: number;
  description: string | null;
  createdAt: string;
}

// ─── Inline SVGs ─────────────────────────────────────────────────────────────

function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// ─── Metadata Row ────────────────────────────────────────────────────────────

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2.5 text-sm py-1">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
      </div>
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-white/90 font-medium text-xs ml-auto">{value}</span>
    </div>
  );
}

// ─── Gradient Divider ────────────────────────────────────────────────────────

function GradientDivider() {
  return (
    <div className="relative h-px w-full my-2">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  // Auth state
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [credits, setCredits] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Checker state
  const [cookieText, setCookieText] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkerResult, setCheckerResult] = useState<CheckerResult | null>(null);

  // Generate token state
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Copy cookie state
  const [copying, setCopying] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState("");
  const [copiedCookieClip, setCopiedCookieClip] = useState(false);

  const [historyCleared, setHistoryCleared] = useState(false);

  // TV activation state
  const [tvCode, setTvCode] = useState("");
  const [tvActivating, setTvActivating] = useState(false);
  const [tvResult, setTvResult] = useState<{ success: boolean; message: string } | null>(null);

  // Referral state
  const [referralCode, setReferralCode] = useState("");
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [canShareCode, setCanShareCode] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // ── Auth Check ──
  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/user/balance");
      const data = await res.json();
      if (data.success) {
        setCredits(data.credits ?? 0);
        if (!historyCleared) {
          setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
        }
      }
    } catch {
      // silent fail — credits already initialized to 0
    }
  }, []);

  const loadReferral = useCallback(async () => {
    try {
      const res = await fetch("/api/user/referral");
      const data = await res.json();
      if (data.success) {
        setReferralCode(data.referralCode || "");
        setTotalReferrals(data.totalReferrals || 0);
        setCanShareCode(!!data.canShare);
      }
    } catch {
      // silent fail — referral already initialized to defaults
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.success) {
          router.push("/login");
        } else if (data.user.role === "ADMIN") {
          router.push("/admin");
        } else {
          setUsername(data.user.username || "");
          setCredits(data.user.credits ?? 0);
          loadBalance();
          loadReferral();
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.push("/login");
      });
    return () => { cancelled = true; };
  }, [router, loadBalance, loadReferral]);


  const refreshCredits = useCallback(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setCredits(data.user.credits ?? 0);
      })
      .catch(() => {});
  }, []);
  // ── TV Activate (5 credits) ──
  const handleTvActivate = useCallback(async () => {
    if (!tvCode.trim()) {
      toast.error("Ingresa el código de 8 dígitos de tu TV");
      return;
    }
    if (!/^\d{8}$/.test(tvCode.trim())) {
      toast.error("El código debe tener exactamente 8 números");
      return;
    }
    if (credits < 5) {
      toast.error("Créditos insuficientes. Necesitas 5 créditos.");
      return;
    }
    setTvActivating(true);
    setTvResult(null);
    try {
      const res = await fetch("/api/user/tv-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tvCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTvResult({ success: true, message: data.message });
        setTvCode("");
        setCredits(data.remainingCredits);
        refreshCredits();
        loadBalance();
        toast.success("TV activada correctamente");
      } else {
        setTvResult({ success: false, message: data.error || "Error al activar TV" });
        if (data.retry || data.noCookies) {
          toast.error(data.error || "Error con la cookie, intenta de nuevo");
        }
        refreshCredits();
      }
    } catch {
      toast.error("Error de conexión");
      setTvResult({ success: false, message: "Error de conexión al servidor" });
    } finally {
      setTvActivating(false);
    }
  }, [tvCode, credits, refreshCredits, loadBalance]);


  // ── Checker: Verify own cookie (free) ──
  const handleCheck = useCallback(async () => {
    if (!cookieText.trim()) {
      toast.error("Pega una cookie para verificar");
      return;
    }
    setChecking(true);
    setCheckerResult(null);
    try {
      const res = await fetch("/api/check-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookieText: cookieText.trim() }),
      });
      const data = await res.json();
      setCheckerResult(data);
      if (data.success) {
        toast.success("Cookie válida");
      } else {
        toast.error(data.error || "Cookie inválida");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setChecking(false);
    }
  }, [cookieText]);

  // ── Generate Token (1 credit) ──
  const handleGenerate = useCallback(async () => {
    if (credits < 1) {
      toast.error("Créditos insuficientes. Pide más al administrador.");
      return;
    }
    setGenerating(true);
    setGeneratedLink("");
    try {
      const res = await fetch("/api/user/generate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setGeneratedLink(data.link);
        setCredits(data.remainingCredits);
        refreshCredits();
        loadBalance();
        toast.success("Token generado exitosamente");
      } else {
        if (data.noCookies) {
          toast.error("No hay cookies disponibles. Se ha notificado al administrador.");
        } else if (data.retry) {
          toast.error("Cookie dañada, intenta de nuevo...");
        } else {
          toast.error(data.error || "Error al generar token");
        }
        refreshCredits();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setGenerating(false);
    }
  }, [credits, loadBalance, refreshCredits]);

  // ── Copy Cookie (3 credits) ──
  const handleCopyCookie = useCallback(async () => {
    if (credits < 3) {
      toast.error("Créditos insuficientes. Necesitas 3 créditos.");
      return;
    }
    setCopying(true);
    setCopiedCookie("");
    try {
      const res = await fetch("/api/user/copy-cookie", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCopiedCookie(data.cookie);
        setCredits(data.remainingCredits);
        refreshCredits();
        loadBalance();
        toast.success("Cookie obtenida exitosamente");
      } else {
        if (data.noCookies) {
          toast.error("No hay cookies disponibles. Se ha notificado al administrador.");
        } else if (data.retry) {
          toast.error("Cookie dañada, intenta de nuevo...");
        } else {
          toast.error(data.error || "Error al copiar cookie");
        }
        refreshCredits();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCopying(false);
    }
  }, [credits, loadBalance, refreshCredits]);

  // ── Clipboard helpers ──
  const copyToClip = useCallback(async (text: string, set: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      set(true);
      toast.success("Copiado");
      setTimeout(() => set(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }, []);

  // ── Referral ──
  const handleRedeem = useCallback(async () => {
    if (!redeemCode.trim()) {
      toast.error("Ingresa un código de referido");
      return;
    }
    setRedeeming(true);
    try {
      const res = await fetch("/api/user/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setRedeemCode("");
        refreshCredits();
        loadBalance();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setRedeeming(false);
    }
  }, [redeemCode, refreshCredits, loadBalance]);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  /* ═══════════════════════════════════════════════════════════════════════════
     ║  REDESIGNED UI — Premium Dark Glassmorphism                           ║
     ╚══════════════════════════════════════════════════════════════════════════ */

  // ── A) LOADING SCREEN: Cinematic 3-ring orbital loader ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020204] overflow-hidden">
        {/* Ambient radial glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full bg-[#E50914]/[0.03] blur-[120px]" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-[#8B5CF6]/[0.03] blur-[100px]" />
        </div>
        <div className="relative flex flex-col items-center gap-8">
          {/* 3-ring orbital spinner */}
          <div className="relative w-28 h-28">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border border-[#E50914]/20 animate-orbital-outer" />
            <div className="absolute inset-0 rounded-full border border-transparent border-t-[#E50914] animate-orbital-outer" style={{ borderTopWidth: "2px" }} />
            {/* Middle ring */}
            <div className="absolute inset-4 rounded-full border border-[#8B5CF6]/20 animate-orbital-middle" />
            <div className="absolute inset-4 rounded-full border border-transparent border-t-[#8B5CF6] animate-orbital-middle" style={{ borderTopWidth: "2px" }} />
            {/* Inner ring */}
            <div className="absolute inset-8 rounded-full border border-[#3B82F6]/20 animate-orbital-inner" />
            <div className="absolute inset-8 rounded-full border border-transparent border-t-[#3B82F6] animate-orbital-inner" style={{ borderTopWidth: "2px" }} />
            {/* Center dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white/80 shadow-[0_0_20px_rgba(255,255,255,0.3)] animate-pulse" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-white/50 text-sm font-medium tracking-[0.2em] uppercase animate-fade-in-up">
              Netflix Checker Pro
            </p>
            <p className="text-white/15 text-xs tracking-widest animate-fade-in-up-delay">
              Inicializando panel...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#020204]">
      {/* ─── B) Animated Gradient Header Line ─── */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#E50914] via-[#8B5CF6] to-transparent bg-[length:200%_100%] animate-gradient-shift" />

      {/* ─── B) Header: Spacious, avatar circle, animated gradient below ─── */}
      <header className="bg-[#020204]/70 backdrop-blur-2xl sticky top-0 z-50 border-b border-white/[0.04]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <img
              src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
              alt="Netflix Checker Pro"
              className="h-9 w-auto rounded-lg object-contain ring-1 ring-white/[0.06]"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold tracking-tight text-white/95">
                Netflix Checker<span className="text-[#E50914] ml-1.5">Pro</span>
              </h1>
              <p className="text-[9px] text-white/20 tracking-[0.25em] uppercase font-medium">Premium Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Credits pill */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-950/30 to-yellow-950/10 border border-amber-500/[0.08] rounded-full px-4 py-2 animate-credits-glow glass-shimmer-subtle">
              <Coins className="h-4 w-4 text-amber-400" />
              <span className="text-amber-200 text-sm font-bold tabular-nums">{credits}</span>
            </div>
            {/* Avatar circle + username */}
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#E50914]/30 to-[#8B5CF6]/30 border border-white/[0.08] flex items-center justify-center text-white/70 text-xs font-bold uppercase">
                {username ? username[0] : "?"}
              </div>
              <span className="text-white/40 text-xs font-medium max-w-[100px] truncate">{username}</span>
            </div>
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="h-9 w-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-300 hover:shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Animated gradient line below header */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">

        {/* ═══ C) PREMIUM CREDIT BANNER — Glass card with mesh border ═══ */}
        <div className="relative rounded-2xl overflow-hidden animate-mesh-border p-[1px]">
          {/* Animated mesh gradient background for border */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 animate-mesh-border-rotate opacity-40" />
          <div className="relative rounded-2xl bg-[#0a0a12]/90 backdrop-blur-xl overflow-hidden">
            {/* Inner ambient glows */}
            <div className="absolute top-0 left-1/4 w-48 h-48 bg-amber-500/[0.04] rounded-full blur-[80px]" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-orange-500/[0.03] rounded-full blur-[80px]" />
            <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
            <CardContent className="relative p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/15 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.08)]">
                      <Coins className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                  </div>
                  <div>
                    <p className="text-amber-200 font-extrabold text-4xl tabular-nums tracking-tight animate-pulse-slow" style={{ textShadow: "0 0 40px rgba(251,191,36,0.2)" }}>
                      {credits}
                    </p>
                    <p className="text-white/20 text-[10px] uppercase tracking-[0.2em] mt-1">Créditos disponibles</p>
                  </div>
                </div>
                {/* Pricing as horizontal chips/pills */}
                <div className="flex flex-wrap gap-2 sm:gap-2.5">
                  <div className="flex items-center gap-2 bg-emerald-500/[0.08] border border-emerald-500/[0.12] rounded-full px-3.5 py-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    <span className="text-white/50 text-[11px]">Token</span>
                    <span className="text-emerald-400 text-[11px] font-bold">1</span>
                  </div>
                  <div className="flex items-center gap-2 bg-violet-500/[0.08] border border-violet-500/[0.12] rounded-full px-3.5 py-2">
                    <div className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]" />
                    <span className="text-white/50 text-[11px]">Cookie</span>
                    <span className="text-violet-400 text-[11px] font-bold">3</span>
                  </div>
                  <div className="flex items-center gap-2 bg-sky-500/[0.08] border border-sky-500/[0.12] rounded-full px-3.5 py-2">
                    <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
                    <span className="text-white/50 text-[11px]">Checker</span>
                    <span className="text-sky-400 text-[11px] font-bold">Gratis</span>
                  </div>
                  <div className="flex items-center gap-2 bg-rose-500/[0.08] border border-rose-500/[0.12] rounded-full px-3.5 py-2">
                    <div className="h-2 w-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]" />
                    <span className="text-white/50 text-[11px]">TV</span>
                    <span className="text-rose-400 text-[11px] font-bold">5</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </div>

        {/* ═══ D) TABS: Scrollable horizontal pill navigation ═══ */}
        <Tabs defaultValue="checker" className="space-y-6">
          <TabsList className="bg-[#0a0a12]/60 backdrop-blur-xl border border-white/[0.04] w-full h-auto p-1.5 rounded-2xl overflow-x-auto premium-scrollbar flex gap-2 sm:gap-1">
            <TabsTrigger
              value="checker"
              className="flex-shrink-0 flex items-center gap-2 px-4 sm:flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-sky-500/[0.12] data-[state=active]:text-sky-400 data-[state=active]:border-sky-500/30 data-[state=active]:shadow-[0_0_25px_rgba(56,189,248,0.1),0_1px_0_0_rgba(56,189,248,0.2)_inset] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-all duration-300 rounded-xl border border-transparent"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Checker</span>
            </TabsTrigger>
            <TabsTrigger
              value="generate"
              className="flex-shrink-0 flex items-center gap-2 px-4 sm:flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-emerald-500/[0.12] data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 data-[state=active]:shadow-[0_0_25px_rgba(52,211,153,0.1),0_1px_0_0_rgba(52,211,153,0.2)_inset] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-all duration-300 rounded-xl border border-transparent"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Generar Token</span>
            </TabsTrigger>
            <TabsTrigger
              value="copy"
              className="flex-shrink-0 flex items-center gap-2 px-4 sm:flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-violet-500/[0.12] data-[state=active]:text-violet-400 data-[state=active]:border-violet-500/30 data-[state=active]:shadow-[0_0_25px_rgba(167,139,250,0.1),0_1px_0_0_rgba(167,139,250,0.2)_inset] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-all duration-300 rounded-xl border border-transparent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Generar Cookie</span>
            </TabsTrigger>
            <TabsTrigger
              value="tv"
              className="flex-shrink-0 flex items-center gap-2 px-4 sm:flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-rose-500/[0.12] data-[state=active]:text-rose-400 data-[state=active]:border-rose-500/30 data-[state=active]:shadow-[0_0_25px_rgba(251,113,133,0.1),0_1px_0_0_rgba(251,113,133,0.2)_inset] text-white/30 hover:text-white/50 hover:bg-white/[0.02] transition-all duration-300 rounded-xl border border-transparent"
            >
              <MonitorPlay className="h-3.5 w-3.5" />
              <span>Activar TV</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ E) TAB 1: CHECKER — Glass card with animated border ═══ */}
          <TabsContent value="checker" className="space-y-4 animate-slide-in">
            <div className="relative rounded-2xl overflow-hidden animate-subtle-border-glow p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-sky-500/10 via-transparent to-sky-500/10 opacity-50" />
              <div className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardHeader className="pb-3 px-6 pt-6 relative">
                  <CardTitle className="text-white/90 text-sm flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-sky-500/[0.08] border border-sky-500/15 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.08)]">
                      <Search className="h-4 w-4 text-sky-400" />
                    </div>
                    Verificar Cookie Individual
                  </CardTitle>
                  <CardDescription className="text-white/20 text-xs ml-11">
                    Pega tu cookie de Netflix para verificarla y extraer metadatos. Completamente gratis.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 relative">
                  <Textarea
                    value={cookieText}
                    onChange={(e) => setCookieText(e.target.value)}
                    placeholder={"Pega tu cookie aquí...\n\nEjemplo: NetflixId=v1%3B...; SecureNetflixId=v2%3B...; nfvdid=..."}
                    className="bg-[#020204]/60 border-white/[0.05] text-white/80 text-xs font-mono placeholder:text-white/[0.12] min-h-[130px] resize-y focus:border-sky-500/25 focus:ring-1 focus:ring-sky-500/[0.08] rounded-xl transition-all duration-300 backdrop-blur-sm"
                  />
                  {/* Verify button with animated gradient border */}
                  <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-sky-500/20 via-sky-400/10 to-sky-500/20 animate-gradient-shift bg-[length:200%_100%]">
                    <Button
                      onClick={handleCheck}
                      disabled={checking || !cookieText.trim()}
                      className="w-full bg-[#0a0a12] hover:bg-[#0f0f18] text-white font-semibold h-12 transition-all duration-300 disabled:opacity-30 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.1)] hover:shadow-[0_0_35px_rgba(56,189,248,0.2)] text-sm"
                    >
                      {checking ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
                      ) : (
                        <><Search className="h-4 w-4 mr-2" /> Verificar Cookie</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </div>
            </div>

            {/* Scanning animation with orbital rings */}
            {checking && (
              <div className="space-y-3 animate-slide-in">
                <div className="rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
                  <div className="relative h-36 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 scan-line" />
                    {/* Orbital scanning rings */}
                    <div className="absolute w-24 h-24 rounded-full border border-sky-400/10 animate-spin" style={{ animationDuration: "4s" }} />
                    <div className="absolute w-20 h-20 rounded-full border border-sky-400/15 animate-spin" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
                    <div className="absolute w-16 h-16 rounded-full border border-sky-400/20 border-t-sky-400 animate-spin" style={{ animationDuration: "2s" }} />
                    <div className="relative flex flex-col items-center gap-3 z-10">
                      <Shield className="h-6 w-6 text-sky-400/60 animate-pulse" />
                      <span className="text-sky-400/40 text-[10px] uppercase tracking-[0.3em] font-medium">Scanning...</span>
                    </div>
                  </div>
                </div>
                <Skeleton className="h-16 w-full bg-[#0a0a12] border border-white/[0.04] rounded-xl" />
              </div>
            )}

            {checkerResult && !checking && (
              <div className="space-y-3 animate-slide-in">
              {/* Limpiar Historial Button */}
              <button
                onClick={() => { setCheckerResult(null); setCookieText(""); setCopiedLink(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] text-white/30 hover:text-white/60 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 text-xs font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
              {checkerResult.success ? (
                <div className="rounded-2xl border border-emerald-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden relative animate-slide-in">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/[0.08] to-transparent pointer-events-none" />
                  <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                  <CardHeader className="pb-3 px-6 pt-6 relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.08)]">
                          <Shield className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-emerald-400 text-sm font-semibold">Cookie Válida</CardTitle>
                          <CardDescription className="text-white/25 text-xs">
                            {checkerResult.metadata?.plan || "Plan Desconocido"}
                            {checkerResult.metadata?.countryName ? ` • ${checkerResult.metadata.countryName}` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/25 text-emerald-400 text-[10px] bg-emerald-500/[0.04]">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                        {checkerResult.metadata?.status || "Activa"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-3 relative">
                    {checkerResult.link && (
                      <div className="bg-[#020204]/50 rounded-xl p-3.5 border border-white/[0.04] backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> NFToken
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClip(checkerResult.link!, setCopiedLink)}
                              className="h-7 px-2.5 text-[10px] text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
                            >
                              {copiedLink ? <><Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Copiado</span></> : <><CopyIcon className="h-3 w-3" /> Copiar</>}
                            </button>
                            <a href={checkerResult.link} target="_blank" rel="noopener noreferrer"
                              className="h-7 px-2.5 text-[10px] text-white/30 hover:text-white/70 hover:bg-white/[0.06] inline-flex items-center rounded-lg transition-all duration-200">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <p className="text-[10px] text-white/15 font-mono break-all leading-relaxed">{checkerResult.link}</p>
                      </div>
                    )}
                    <GradientDivider />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      <MetaRow icon={Globe} label="País" value={checkerResult.metadata?.countryName || checkerResult.metadata?.country} />
                      <MetaRow icon={Tv} label="Plan" value={checkerResult.metadata?.plan} />
                      <MetaRow icon={Mail} label="Email" value={checkerResult.metadata?.email} />
                      <MetaRow icon={Calendar} label="Desde" value={checkerResult.metadata?.memberSince} />
                      <MetaRow icon={Calendar} label="Próx. Cobro" value={checkerResult.metadata?.nextBilling} />
                      <MetaRow icon={CreditCard} label="Pago" value={checkerResult.metadata?.paymentMethod} />
                    </div>
                  </CardContent>
                </div>
              ) : (
                <div className="rounded-2xl border border-red-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden animate-slide-in">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl bg-red-500/[0.08] border border-red-500/15 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.08)]">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-400 font-semibold text-sm">Cookie Inválida</h4>
                        <p className="text-white/20 text-xs mt-1">{checkerResult.error || "Error desconocido"}</p>
                      </div>
                    </div>
                  </CardContent>
                </div>
              )}
              </div>
            )}
          </TabsContent>

          {/* ═══ F) TAB 2: GENERATE TOKEN — Pulse button, slide-in success ═══ */}
          <TabsContent value="generate" className="space-y-4 animate-slide-in">
            <div className="relative rounded-2xl overflow-hidden p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/10 opacity-50" />
              <div className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/[0.06] to-transparent pointer-events-none" />
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardHeader className="pb-3 px-6 pt-6 relative">
                  <CardTitle className="text-emerald-400 text-sm flex items-center gap-3 font-semibold">
                    <div className="h-8 w-8 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.08)]">
                      <Zap className="h-4 w-4" />
                    </div>
                    Generar Token de Netflix
                  </CardTitle>
                  <CardDescription className="text-white/20 text-xs ml-11">
                    Se usa una cookie del servidor para generar tu link de acceso. Cuesta <span className="text-white/50 font-semibold">1 crédito</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 relative">
                  {/* Prominent cost display */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#020204]/50 border border-white/[0.04] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/[0.08] border border-amber-500/10 flex items-center justify-center">
                        <Coins className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white/30 text-[10px] uppercase tracking-widest">Tu saldo</p>
                        <span className={`text-2xl font-extrabold tabular-nums ${credits >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                          {credits}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/15 text-[10px] uppercase tracking-widest">Costo</p>
                      <span className="text-white/60 text-lg font-bold tabular-nums">1</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generating || credits < 1}
                    className={`w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold h-13 transition-all duration-300 disabled:opacity-30 rounded-xl shadow-[0_0_25px_rgba(52,211,153,0.12)] hover:shadow-[0_0_40px_rgba(52,211,153,0.2)] text-base ${credits >= 1 && !generating ? "animate-subtle-pulse-glow" : ""}`}
                  >
                    {generating ? (
                      <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Token...</>
                    ) : (
                      <><Zap className="h-5 w-5 mr-2" /> Generar Token</>
                    )}
                  </Button>

                  {credits < 1 && (
                    <p className="text-red-400/30 text-xs text-center">
                      Créditos insuficientes. Contacta al administrador para obtener más.
                    </p>
                  )}
                </CardContent>
              </div>
            </div>

            {/* Slide-in success state */}
            {generatedLink && (
              <div className="rounded-2xl border border-emerald-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden animate-slide-in">
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardContent className="p-6 space-y-4 relative">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.08)]">
                      <Check className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-emerald-400 font-semibold text-sm">Token Generado</p>
                      <p className="text-white/20 text-xs">Créditos restantes: {credits}</p>
                    </div>
                  </div>
                  <div className="bg-[#020204]/50 rounded-xl p-4 border border-white/[0.04] backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Tu Link de Netflix
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClip(generatedLink, setCopiedLink)}
                          className="h-7 px-3 text-[10px] text-white/30 hover:text-white/70 hover:bg-white/[0.06] rounded-lg transition-all duration-200 flex items-center gap-1.5"
                        >
                          {copiedLink ? <><Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Copiado</span></> : <><CopyIcon className="h-3 w-3" /> Copiar Link</>}
                        </button>
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-3 text-[10px] text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all duration-200 flex items-center gap-1 font-medium"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/12 font-mono break-all leading-relaxed">{generatedLink}</p>
                  </div>
                </CardContent>
              </div>
            )}
          </TabsContent>

          {/* ═══ G) TAB 3: COPY COOKIE — Glass treatment, code block ═══ */}
          <TabsContent value="copy" className="space-y-4 animate-slide-in">
            <div className="relative rounded-2xl overflow-hidden p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/10 via-transparent to-violet-500/10 opacity-50" />
              <div className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-950/[0.06] to-transparent pointer-events-none" />
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardHeader className="pb-3 px-6 pt-6 relative">
                  <CardTitle className="text-violet-400 text-sm flex items-center gap-3 font-semibold">
                    <div className="h-8 w-8 rounded-xl bg-violet-500/[0.08] border border-violet-500/15 flex items-center justify-center shadow-[0_0_15px_rgba(167,139,250,0.08)]">
                      <RefreshCw className="h-4 w-4" />
                    </div>
                    Generar Cookie de Netflix
                  </CardTitle>
                  <CardDescription className="text-white/20 text-xs ml-11">
                    Genera una cookie funcional del servidor. Cuesta <span className="text-white/50 font-semibold">3 créditos</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6 relative">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#020204]/50 border border-white/[0.04] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-amber-500/[0.08] border border-amber-500/10 flex items-center justify-center">
                        <Coins className="h-5 w-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white/30 text-[10px] uppercase tracking-widest">Tu saldo</p>
                        <span className={`text-2xl font-extrabold tabular-nums ${credits >= 3 ? "text-emerald-400" : "text-red-400"}`}>
                          {credits}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/15 text-[10px] uppercase tracking-widest">Costo</p>
                      <span className="text-white/60 text-lg font-bold tabular-nums">3</span>
                    </div>
                  </div>

                  <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-violet-500/20 via-violet-400/10 to-violet-500/20 animate-gradient-shift bg-[length:200%_100%]">
                    <Button
                      onClick={handleCopyCookie}
                      disabled={copying || credits < 3}
                      className="w-full bg-[#0a0a12] hover:bg-[#0f0f18] text-white font-semibold h-13 transition-all duration-300 disabled:opacity-30 rounded-xl shadow-[0_0_25px_rgba(167,139,250,0.12)] hover:shadow-[0_0_40px_rgba(167,139,250,0.2)] text-base"
                    >
                      {copying ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Cookie...</>
                      ) : (
                        <><RefreshCw className="h-5 w-5 mr-2" /> Generar Cookie</>
                      )}
                    </Button>
                  </div>

                  {credits < 3 && (
                    <p className="text-red-400/30 text-xs text-center">
                      Necesitas al menos 3 créditos. Contacta al administrador.
                    </p>
                  )}
                </CardContent>
              </div>
            </div>

            {/* Cookie display in glass code block */}
            {copiedCookie && (
              <div className="rounded-2xl border border-violet-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden animate-slide-in">
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardContent className="p-6 space-y-4 relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-violet-500/[0.08] border border-violet-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(167,139,250,0.08)]">
                        <Check className="h-5 w-5 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-violet-400 font-semibold text-sm">Cookie Obtenida</p>
                        <p className="text-white/20 text-xs">Créditos restantes: {credits}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClip(copiedCookie, setCopiedCookieClip)}
                      className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-xs font-medium rounded-xl transition-all duration-300 flex items-center gap-2 shadow-[0_0_20px_rgba(167,139,250,0.12)]"
                    >
                      {copiedCookieClip ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><CopyIcon className="h-3.5 w-3.5" /> Copiar Cookie</>}
                    </button>
                  </div>
                  {/* Glass code block */}
                  <div className="relative rounded-xl overflow-hidden border border-white/[0.04]">
                    <div className="bg-[#020204]/70 px-4 py-1.5 border-b border-white/[0.04] flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500/40" />
                      <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                      <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                      <span className="text-white/15 text-[9px] ml-2 font-mono uppercase tracking-wider">cookie</span>
                    </div>
                    <div className="bg-[#020204]/50 p-4 backdrop-blur-sm">
                      <p className="text-[10px] text-white/12 font-mono break-all leading-relaxed max-h-28 overflow-y-auto premium-scrollbar">
                        {copiedCookie}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </div>
            )}
          </TabsContent>

          {/* ═══ H) TAB 4: ACTIVAR TV — Large centered numeric, vertical timeline, crimson button ═══ */}
          <TabsContent value="tv" className="space-y-4 animate-slide-in">
            <div className="relative rounded-2xl overflow-hidden p-[1px]">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-rose-500/10 via-transparent to-rose-500/10 opacity-50" />
              <div className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-950/[0.06] to-transparent pointer-events-none" />
                <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
                <CardHeader className="pb-3 px-6 pt-6 relative">
                  <CardTitle className="text-rose-400 text-sm flex items-center gap-3 font-semibold">
                    <div className="h-8 w-8 rounded-xl bg-rose-500/[0.08] border border-rose-500/15 flex items-center justify-center shadow-[0_0_15px_rgba(251,113,133,0.08)]">
                      <MonitorPlay className="h-4 w-4" />
                    </div>
                    Activar Netflix en TV
                  </CardTitle>
                  <CardDescription className="text-white/20 text-xs ml-11">
                    Ingresa el código de 8 dígitos que aparece en tu TV. Cuesta <span className="text-white/50 font-semibold">5 créditos</span>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 px-6 pb-6 relative">
                  {/* Vertical timeline steps */}
                  <div className="space-y-0">
                    {[
                      "Abre Netflix en tu Smart TV o consola",
                      "Selecciona \"Iniciar sesión\" → \"Iniciar sesión en la web\"",
                      "Copia el código de 8 dígitos que aparece",
                      "Pégalo aquí y presiona Activar"
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                            i === 0
                              ? "bg-rose-500/15 border border-rose-500/25 text-rose-400"
                              : "bg-white/[0.03] border border-white/[0.06] text-white/20"
                          }`}>
                            {i + 1}
                          </div>
                          {i < 3 && <div className={`w-px h-6 ${i === 0 ? "bg-rose-500/15" : "bg-white/[0.04]"}`} />}
                        </div>
                        <p className={`text-xs pt-1 ${i === 0 ? "text-white/50" : "text-white/25"}`}>{step}</p>
                      </div>
                    ))}
                  </div>

                  {/* Large centered numeric display */}
                  <div className="relative max-w-xs mx-auto">
                    <Input
                      value={tvCode}
                      onChange={(e) => setTvCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      placeholder="· · · · · · · ·"
                      className="bg-[#020204]/60 border-white/[0.05] text-white/90 placeholder:text-white/[0.08] text-center text-3xl font-mono font-bold tracking-[0.4em] h-20 rounded-2xl focus:border-rose-500/30 focus:ring-2 focus:ring-rose-500/[0.06] transition-all duration-300 backdrop-blur-sm"
                      maxLength={8}
                    />
                    {tvCode.length > 0 && (
                      <div className="absolute right-4 top-4">
                        <span className="text-white/10 text-[10px] font-mono">{tvCode.length}/8</span>
                      </div>
                    )}
                  </div>

                  {/* Balance */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-[#020204]/50 border border-white/[0.04] backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <Coins className="h-4 w-4 text-amber-400" />
                      <span className="text-white/30 text-xs">Costo:</span>
                      <span className="text-rose-400 font-bold text-lg tabular-nums">5</span>
                      <span className="text-white/15 text-xs">créditos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/15 text-xs">Saldo:</span>
                      <span className={`text-sm font-bold tabular-nums ${credits >= 5 ? "text-emerald-400" : "text-red-400"}`}>
                        {credits}
                      </span>
                    </div>
                  </div>

                  {/* Crimson gradient activate button with glow */}
                  <div className="relative rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 animate-gradient-shift bg-[length:200%_100%]" />
                    <Button
                      onClick={handleTvActivate}
                      disabled={tvActivating || tvCode.length !== 8 || credits < 5}
                      className="relative w-full bg-transparent hover:bg-transparent text-white font-semibold h-13 transition-all duration-300 disabled:opacity-20 rounded-xl shadow-[0_0_30px_rgba(251,113,133,0.15)] hover:shadow-[0_0_50px_rgba(251,113,133,0.25)] text-base"
                    >
                      {tvActivating ? (
                        <>
                          <div className="h-5 w-5 mr-2 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Activando TV...
                        </>
                      ) : (
                        <><MonitorPlay className="h-5 w-5 mr-2" /> Activar TV</>
                      )}
                    </Button>
                  </div>

                  {credits < 5 && (
                    <p className="text-red-400/30 text-xs text-center">
                      Necesitas al menos 5 créditos. Contacta al administrador.
                    </p>
                  )}

                  {/* Loading animation with orbital rings */}
                  {tvActivating && (
                    <div className="rounded-2xl border border-rose-500/[0.08] bg-[#0a0a12]/80 overflow-hidden animate-slide-in">
                      <div className="relative h-28 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 scan-line" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(251,113,133,0.03) 40%, rgba(251,113,133,0.06) 50%, rgba(251,113,133,0.03) 60%, transparent 100%)" }} />
                        <div className="absolute w-20 h-20 rounded-full border border-rose-400/10 animate-spin" style={{ animationDuration: "4s" }} />
                        <div className="absolute w-16 h-16 rounded-full border border-rose-400/15 animate-spin" style={{ animationDuration: "3s", animationDirection: "reverse" }} />
                        <div className="absolute w-12 h-12 rounded-full border border-rose-400/20 border-t-rose-400 animate-spin" style={{ animationDuration: "2s" }} />
                        <div className="relative flex flex-col items-center gap-2 z-10">
                          <span className="text-rose-400/40 text-[10px] uppercase tracking-[0.3em] font-medium">Activando TV...</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  {tvResult && !tvActivating && (
                    tvResult.success ? (
                      <div className="rounded-2xl border border-emerald-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden animate-slide-in">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-3">
                            <div className="h-11 w-11 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/15 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(52,211,153,0.08)]">
                              <Check className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-emerald-400 font-semibold text-sm">TV Activada</h4>
                              <p className="text-white/25 text-xs mt-1">Netflix en tu TV está listo. Disfruta.</p>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-red-500/[0.12] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden animate-slide-in">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-3">
                            <div className="h-11 w-11 rounded-xl bg-red-500/[0.08] border border-red-500/15 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.08)]">
                              <X className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="flex-1">
                              <h4 className="text-red-400 font-semibold text-sm">Error al activar</h4>
                              <p className="text-white/20 text-xs mt-1">{tvResult.message}</p>
                              <button
                                onClick={() => setTvResult(null)}
                                className="mt-3 text-white/25 hover:text-white/50 text-[10px] transition-colors flex items-center gap-1"
                              >
                                <RotateCcw className="h-3 w-3" /> Intentar de nuevo
                              </button>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    )
                  )}
                </CardContent>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ═══ Section Divider ═══ */}
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#E50914]/20 to-transparent" />
        </div>

        {/* ═══ I) REFERRAL SECTION — Glass card with gradient border ═══ */}
        <div className="relative rounded-2xl overflow-hidden animate-mesh-border p-[1px]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-orange-500/20 animate-mesh-border-rotate opacity-30" />
          <div className="relative rounded-2xl bg-[#0a0a12]/90 backdrop-blur-xl overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/[0.03] rounded-full blur-[80px]" />
            <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
            <CardHeader className="pb-3 px-6 pt-6 relative">
              <CardTitle className="text-orange-300 text-sm flex items-center gap-3 font-semibold">
                <div className="h-8 w-8 rounded-xl bg-orange-500/[0.08] border border-orange-500/15 flex items-center justify-center shadow-[0_0_15px_rgba(234,88,12,0.08)]">
                  <Gift className="h-4 w-4 text-orange-400" />
                </div>
                Sistema de Referidos
              </CardTitle>
              <CardDescription className="text-white/20 text-xs ml-11">
                Comparte tu código y gana <span className="text-white/50 font-semibold">+5 créditos</span> por cada persona que se registre.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-6 relative">
              {/* Large glass referral code display */}
              <div className="bg-[#020204]/50 border border-white/[0.05] rounded-2xl p-5 backdrop-blur-sm">
                <p className="text-white/15 text-[9px] uppercase tracking-[0.25em] mb-2">Tu código de referido</p>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-white/90 font-mono font-extrabold text-2xl tracking-[0.15em]">
                    {referralCode || "· · · · · · · ·"}
                  </p>
                  <button
                    onClick={() => copyToClip(referralCode, setCodeCopied)}
                    disabled={!referralCode}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-medium flex items-center gap-2 transition-all duration-300 disabled:opacity-20 shadow-[0_0_20px_rgba(234,88,12,0.12)] shrink-0"
                  >
                    {codeCopied ? <><Check className="h-4 w-4" /> Copiado</> : <><Share2 className="h-4 w-4" /> Copiar</>}
                  </button>
                </div>
              </div>

              {canShareCode ? (
                <p className="text-emerald-400/40 text-[10px] text-center flex items-center justify-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  Tu código está activo y listo para compartir
                </p>
              ) : (
                <p className="text-amber-400/40 text-[10px] text-center flex items-center justify-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Tu código se activa en 10 minutos después del registro
                </p>
              )}

              {/* Glass metric cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#020204]/50 border border-white/[0.04] p-4 text-center backdrop-blur-sm">
                  <p className="text-orange-300 font-extrabold text-3xl tabular-nums" style={{ textShadow: "0 0 20px rgba(234,88,12,0.15)" }}>
                    {totalReferrals}
                  </p>
                  <p className="text-white/15 text-[9px] uppercase tracking-[0.2em] mt-1">Referidos</p>
                </div>
                <div className="rounded-xl bg-[#020204]/50 border border-white/[0.04] p-4 text-center backdrop-blur-sm">
                  <p className="text-amber-300 font-extrabold text-3xl tabular-nums" style={{ textShadow: "0 0 20px rgba(251,191,36,0.15)" }}>
                    {totalReferrals * 5}
                  </p>
                  <p className="text-white/15 text-[9px] uppercase tracking-[0.2em] mt-1">Créditos ganados</p>
                </div>
              </div>

              {/* Redeem input integrated smoothly */}
              <div className="relative pt-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
                <p className="text-white/30 text-xs font-medium mb-3 flex items-center gap-1.5">
                  <Gift className="h-3 w-3 text-orange-400/50" /> ¿Tienes un código de referido?
                </p>
                <div className="flex gap-2">
                  <Input
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder="NF-XXXXXX"
                    className="flex-1 bg-[#020204]/60 border-white/[0.05] text-white/80 placeholder:text-white/[0.12] uppercase font-mono rounded-xl focus:border-orange-500/25 focus:ring-1 focus:ring-orange-500/[0.06] transition-all duration-300 text-sm backdrop-blur-sm"
                  />
                  <Button
                    onClick={handleRedeem}
                    disabled={redeeming || !redeemCode.trim()}
                    className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-medium h-10 px-6 disabled:opacity-20 shrink-0 rounded-xl shadow-[0_0_20px_rgba(234,88,12,0.12)] transition-all duration-300"
                  >
                    {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Canjear"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        </div>

        {/* ═══ Section Divider ═══ */}
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
        </div>

        {/* ═══ J) BUY CREDITS — Glass cards with hover effects ═══ */}
        <div className="relative rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/[0.06] via-transparent to-sky-950/[0.04]" />
          <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
          <CardContent className="relative p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500/[0.1] to-sky-500/[0.08] border border-emerald-500/15 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.06)]">
                  <Coins className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-semibold">¿Necesitas más créditos?</p>
                <p className="text-white/20 text-[11px]">Contacta al administrador para adquirir paquetes</p>
              </div>
            </div>
            {/* Glass contact cards */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center gap-2.5 px-4 py-4 rounded-xl bg-[#020204]/50 hover:bg-[#25D366]/[0.06] border border-white/[0.05] hover:border-[#25D366]/20 transition-all duration-400 text-[#25D366] text-xs font-semibold shadow-[0_0_0px_rgba(37,211,102,0)] hover:shadow-[0_0_30px_rgba(37,211,102,0.1)] backdrop-blur-sm overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#25D366]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                <svg className="h-5 w-5 group-hover:scale-110 transition-transform duration-300 relative" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span className="relative">WhatsApp</span>
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center gap-2.5 px-4 py-4 rounded-xl bg-[#020204]/50 hover:bg-[#229ED9]/[0.06] border border-white/[0.05] hover:border-[#229ED9]/20 transition-all duration-400 text-[#229ED9] text-xs font-semibold shadow-[0_0_0px_rgba(34,158,217,0)] hover:shadow-[0_0_30px_rgba(34,158,217,0.1)] backdrop-blur-sm overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#229ED9]/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
                <svg className="h-5 w-5 group-hover:scale-110 transition-transform duration-300 relative" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                <span className="relative">Telegram</span>
              </a>
            </div>
            <p className="text-white/10 text-[10px] text-center">
              Respuesta rápida. Paquetes a tu medida.
            </p>
          </CardContent>
        </div>

        {/* ═══ K) TRANSACTION HISTORY — Glass rows with timeline indicators ═══ */}
        <div className="rounded-2xl border border-white/[0.04] bg-[#0a0a12]/80 backdrop-blur-xl overflow-hidden">
          <div className="glass-shimmer-subtle absolute inset-0 rounded-2xl" />
          <CardHeader className="pb-3 px-6 pt-6 relative">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white/60 text-sm flex items-center gap-3 font-semibold">
                <div className="h-8 w-8 rounded-xl bg-[#E50914]/[0.06] border border-[#E50914]/15 flex items-center justify-center shadow-[0_0_15px_rgba(229,9,20,0.06)]">
                  <CreditCard className="h-4 w-4 text-[#E50914]" />
                </div>
                Historial de Transacciones
              </CardTitle>
              {transactions.length > 0 && (
                <button
                  onClick={() => { setTransactions([]); setHistoryCleared(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] text-white/25 hover:text-white/50 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 text-[10px] font-medium"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 relative">
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto premium-scrollbar">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-white/[0.08]" />
                  </div>
                  <p className="text-white/12 text-xs">Sin actividad aún</p>
                </div>
              ) : (
                transactions.map((t, i) => (
                  <div
                    key={t.id}
                    className="relative flex items-center justify-between p-3.5 rounded-xl border border-white/[0.03] bg-[#020204]/30 hover:bg-white/[0.03] hover:border-white/[0.06] transition-all duration-300 group"
                  >
                    {/* Timeline indicator */}
                    <div className={`absolute left-0 top-0 bottom-0 w-px ${
                      t.credits >= 0 ? "bg-emerald-500/15" : "bg-red-500/15"
                    }`} />
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 backdrop-blur-sm ${
                        t.credits >= 0
                          ? "bg-emerald-500/[0.06] border border-emerald-500/[0.1]"
                          : "bg-red-500/[0.06] border border-red-500/[0.1]"
                      }`}>
                        {t.credits >= 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-emerald-400 rotate-180" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white/50 text-xs font-medium">{t.description || t.type}</p>
                        <p className="text-white/12 text-[10px] flex items-center gap-1 mt-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(t.createdAt).toLocaleString("es")}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${
                      t.credits >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {t.credits >= 0 ? "+" : ""}{t.credits}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.03] bg-[#020204] mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col items-center gap-4">
            <GradientDivider />
            <p className="text-white/15 text-[10px] tracking-wide">
              Netflix Cookie Checker Pro — Desarrollado por <span className="text-white/30 font-semibold">HacheJota</span>
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all duration-300 text-white/20 hover:text-white/40 text-[10px]"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] transition-all duration-300 text-white/20 hover:text-white/40 text-[10px]"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
            <p className="text-white/[0.06] text-[9px]">
              Uso privado únicamente. No afiliado a Netflix, Inc.
            </p>
          </div>
        </div>
      </footer>

      {/* ─── L) Global Premium Styles ─── */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }

        @keyframes scan-move {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }

        @keyframes credits-glow {
          0%, 100% { box-shadow: 0 0 0px rgba(251,191,36,0); }
          50% { box-shadow: 0 0 15px rgba(251,191,36,0.06); }
        }

        @keyframes orbital-outer {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes orbital-middle {
          0% { transform: rotate(120deg); }
          100% { transform: rotate(480deg); }
        }

        @keyframes orbital-inner {
          0% { transform: rotate(240deg); }
          100% { transform: rotate(600deg); }
        }

        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes fade-in-up-delay {
          0%, 30% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes slide-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes mesh-border-rotate {
          0% { transform: rotate(0deg) scale(1.5); }
          100% { transform: rotate(360deg) scale(1.5); }
        }

        @keyframes subtle-pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(52,211,153,0.08); }
          50% { box-shadow: 0 0 35px rgba(52,211,153,0.16); }
        }

        @keyframes subtle-border-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }

        .animate-gradient-shift {
          animation: gradient-shift 6s ease infinite;
        }

        .animate-pulse-slow {
          animation: pulse-slow 3s ease-in-out infinite;
        }

        .animate-credits-glow {
          animation: credits-glow 4s ease-in-out infinite;
        }

        .animate-orbital-outer {
          animation: orbital-outer 4s linear infinite;
        }

        .animate-orbital-middle {
          animation: orbital-middle 3s linear infinite;
        }

        .animate-orbital-inner {
          animation: orbital-inner 2s linear infinite;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.8s ease-out forwards;
        }

        .animate-fade-in-up-delay {
          animation: fade-in-up-delay 1.2s ease-out forwards;
        }

        .animate-slide-in {
          animation: slide-in 0.35s ease-out forwards;
        }

        .animate-mesh-border {
          overflow: hidden;
        }

        .animate-mesh-border-rotate {
          animation: mesh-border-rotate 8s linear infinite;
        }

        .animate-subtle-pulse-glow {
          animation: subtle-pulse-glow 2.5s ease-in-out infinite;
        }

        .animate-subtle-border-glow {
          animation: subtle-border-glow 3s ease-in-out infinite;
        }

        .scan-line {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(56, 189, 248, 0.03) 40%,
            rgba(56, 189, 248, 0.06) 50%,
            rgba(56, 189, 248, 0.03) 60%,
            transparent 100%
          );
          animation: scan-move 2s ease-in-out infinite;
        }

        .glass-shimmer-subtle {
          background: linear-gradient(
            105deg,
            transparent 40%,
            rgba(255, 255, 255, 0.01) 45%,
            rgba(255, 255, 255, 0.03) 50%,
            rgba(255, 255, 255, 0.01) 55%,
            transparent 60%
          );
          background-size: 200% 100%;
          animation: shimmer-slide 8s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes shimmer-slide {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* Premium Scrollbar */
        .premium-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .premium-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .premium-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 2px;
        }
        .premium-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        /* Custom scrollbar for textarea */
        textarea::-webkit-scrollbar {
          width: 4px;
        }
        textarea::-webkit-scrollbar-track {
          background: transparent;
        }
        textarea::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 2px;
        }
        textarea::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.12);
        }

        [role="progressbar"] > div {
          background-color: #E50914 !important;
        }

        /* Smooth overall scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.06) transparent;
        }
      `}</style>
    </div>
  );
}
