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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Loader2 className="h-10 w-10 text-[#E50914] animate-spin" />
            <div className="absolute inset-0 h-10 w-10 rounded-full bg-[#E50914]/20 blur-xl animate-pulse" />
          </div>
          <p className="text-white/40 text-sm tracking-wide">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#050508]">
      {/* ─── Animated Gradient Header Bar ─── */}
      <div className="h-[2px] w-full bg-gradient-to-r from-[#E50914] via-[#8B5CF6] via-[#3B82F6] to-[#E50914] bg-[length:200%_100%] animate-gradient-shift" />

      {/* ─── Header ─── */}
      <header className="border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Image */}
            <img
              src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
              alt="Netflix Checker Pro"
              className="h-8 w-auto rounded-md object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-base font-bold tracking-tight text-white/90">
                Netflix Checker<span className="text-[#E50914] ml-1">Pro</span>
              </h1>
              <p className="text-[10px] text-white/25 tracking-widest uppercase">Premium Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Credits Badge with Pulse */}
            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-950/40 to-yellow-950/20 border border-yellow-500/10 rounded-full px-3 py-1.5 animate-credits-glow">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-300 text-sm font-bold tabular-nums">{credits}</span>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-white/50 text-xs font-medium">{username}</span>
            </div>
            <button
              onClick={handleLogout}
              className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-gray-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* ═══ Premium Credit Banner ═══ */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-950/10 via-transparent to-orange-950/5" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-3xl" />
          <CardContent className="relative p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/20 flex items-center justify-center">
                    <Coins className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
                </div>
                <div>
                  <p className="text-amber-300 font-bold text-2xl tabular-nums tracking-tight animate-pulse-slow">{credits}</p>
                  <p className="text-white/25 text-[10px] uppercase tracking-widest">Créditos disponibles</p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-2 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                  <span className="text-white/40 text-[11px]">Token: <span className="text-white/70 font-medium">1 crédito</span></span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.5)]" />
                  <span className="text-white/40 text-[11px]">Cookie: <span className="text-white/70 font-medium">3 créditos</span></span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]" />
                  <span className="text-white/40 text-[11px]">Checker: <span className="text-emerald-400/80 font-medium">Gratis</span></span>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]" />
                  <span className="text-white/40 text-[11px]">Activar TV: <span className="text-white/70 font-medium">5 créditos</span></span>
                </div>
              </div>
            </div>
          </CardContent>
        </div>

        {/* ═══ Tabs ═══ */}
        <Tabs defaultValue="checker" className="space-y-5">
          <TabsList className="bg-[#0a0a10]/80 backdrop-blur-sm border border-white/[0.06] w-full h-auto p-1 rounded-xl">
            <TabsTrigger
              value="checker"
              className="flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-sky-500/15 data-[state=active]:text-sky-400 data-[state=active]:border-sky-500/20 data-[state=active]:shadow-[0_0_20px_rgba(56,189,248,0.08)] text-white/40 transition-all duration-300 rounded-lg border border-transparent"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Checker
            </TabsTrigger>
            <TabsTrigger
              value="generate"
              className="flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/20 data-[state=active]:shadow-[0_0_20px_rgba(52,211,153,0.08)] text-white/40 transition-all duration-300 rounded-lg border border-transparent"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Generar Token
            </TabsTrigger>
            <TabsTrigger
              value="copy"
              className="flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-violet-500/15 data-[state=active]:text-violet-400 data-[state=active]:border-violet-500/20 data-[state=active]:shadow-[0_0_20px_rgba(167,139,250,0.08)] text-white/40 transition-all duration-300 rounded-lg border border-transparent"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Generar Cookie
            </TabsTrigger>
            <TabsTrigger
              value="tv"
              className="flex-1 py-2.5 text-xs font-medium data-[state=active]:bg-rose-500/15 data-[state=active]:text-rose-400 data-[state=active]:border-rose-500/20 data-[state=active]:shadow-[0_0_20px_rgba(251,113,133,0.08)] text-white/40 transition-all duration-300 rounded-lg border border-transparent"
            >
              <MonitorPlay className="h-3.5 w-3.5 mr-1.5" />
              Activar TV
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB 1: CHECKER ═══ */}
          <TabsContent value="checker" className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
              <CardHeader className="pb-3 px-5 pt-5">
                <CardTitle className="text-white/90 text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                    <Search className="h-3.5 w-3.5 text-sky-400" />
                  </div>
                  Verificar Cookie Individual
                </CardTitle>
                <CardDescription className="text-white/25 text-xs ml-[38px]">
                  Pega tu cookie de Netflix para verificarla y extraer metadatos. Completamente gratis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5">
                <Textarea
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                  placeholder={"Pega tu cookie aquí...\n\nEjemplo: NetflixId=v1%3B...; SecureNetflixId=v2%3B...; nfvdid=..."}
                  className="bg-[#050508]/80 border-white/[0.06] text-white/80 text-xs font-mono placeholder:text-white/15 min-h-[120px] resize-y focus:border-sky-500/30 focus:ring-1 focus:ring-sky-500/10 rounded-xl transition-all duration-300"
                />
                <Button
                  onClick={handleCheck}
                  disabled={checking || !cookieText.trim()}
                  className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-semibold h-11 transition-all duration-300 disabled:opacity-40 rounded-xl shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:shadow-[0_0_30px_rgba(56,189,248,0.25)]"
                >
                  {checking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Verificar Cookie</>
                  )}
                </Button>
              </CardContent>
            </div>

            {/* Scanning Animation */}
            {checking && (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                  <div className="relative h-28 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 scan-line" />
                    <div className="relative flex flex-col items-center gap-2 z-10">
                      <div className="h-8 w-8 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin" />
                      <span className="text-sky-400/60 text-[10px] uppercase tracking-widest">Scanning...</span>
                    </div>
                  </div>
                </div>
                <Skeleton className="h-16 w-full bg-[#0a0a10] border border-white/[0.06] rounded-xl" />
              </div>
            )}

            {checkerResult && !checking && (
              <div className="space-y-3">
              {/* Limpiar Historial Button */}
              <button
                onClick={() => { setCheckerResult(null); setCookieText(""); setCopiedLink(false); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 text-xs font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Limpiar
              </button>
              {checkerResult.success ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/10 to-transparent pointer-events-none" />
                  <CardHeader className="pb-3 px-5 pt-5 relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.1)]">
                          <Shield className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                          <CardTitle className="text-emerald-400 text-sm">Cookie Válida</CardTitle>
                          <CardDescription className="text-white/30 text-xs">
                            {checkerResult.metadata?.plan || "Plan Desconocido"}
                            {checkerResult.metadata?.countryName ? ` • ${checkerResult.metadata.countryName}` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] bg-emerald-500/5">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                        {checkerResult.metadata?.status || "Activa"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-3 relative">
                    {checkerResult.link && (
                      <div className="bg-[#050508]/60 rounded-xl p-3 border border-white/[0.04]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                            <Zap className="h-3 w-3" /> NFToken
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClip(checkerResult.link!, setCopiedLink)}
                              className="h-7 px-2.5 text-[10px] text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded-lg transition-all duration-200"
                            >
                              {copiedLink ? <><Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Copiado</span></> : <><CopyIcon className="h-3 w-3" /> Copiar</>}
                            </button>
                            <a href={checkerResult.link} target="_blank" rel="noopener noreferrer"
                              className="h-7 px-2.5 text-[10px] text-white/40 hover:text-white/80 hover:bg-white/[0.06] inline-flex items-center rounded-lg transition-all duration-200">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <p className="text-[10px] text-white/20 font-mono break-all leading-relaxed">{checkerResult.link}</p>
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
                <div className="rounded-2xl border border-red-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.1)]">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-400 font-semibold text-sm">Cookie Inválida</h4>
                        <p className="text-white/25 text-xs mt-1">{checkerResult.error || "Error desconocido"}</p>
                      </div>
                    </div>
                  </CardContent>
                </div>
              )}
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB 2: GENERATE TOKEN ═══ */}
          <TabsContent value="generate" className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/10 to-transparent pointer-events-none" />
              <CardHeader className="pb-3 px-5 pt-5 relative">
                <CardTitle className="text-emerald-400 text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  Generar Token de Netflix
                </CardTitle>
                <CardDescription className="text-white/25 text-xs ml-[38px]">
                  Se usa una cookie del servidor para generar tu link de acceso. Cuesta <span className="text-white/60 font-semibold">1 crédito</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5 relative">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#050508]/80 border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span className="text-white/40 text-sm">Tu saldo:</span>
                  </div>
                  <span className={`text-xl font-bold tabular-nums ${credits >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                    {credits} <span className="text-xs text-white/20 font-normal">créditos</span>
                  </span>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating || credits < 1}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold h-12 transition-all duration-300 disabled:opacity-40 rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.15)] hover:shadow-[0_0_30px_rgba(52,211,153,0.25)] text-base"
                >
                  {generating ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Token...</>
                  ) : (
                    <><Zap className="h-5 w-5 mr-2" /> Generar Token</>
                  )}
                </Button>

                {credits < 1 && (
                  <p className="text-red-400/40 text-xs text-center">
                    Créditos insuficientes. Contacta al administrador para obtener más.
                  </p>
                )}
              </CardContent>
            </div>

            {generatedLink && (
              <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_12px_rgba(52,211,153,0.1)]">
                      <Check className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-emerald-400 font-semibold text-sm">Token Generado</p>
                      <p className="text-white/25 text-xs">Créditos restantes: {credits}</p>
                    </div>
                  </div>
                  <div className="bg-[#050508]/60 rounded-xl p-3 border border-white/[0.04]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                        <Zap className="h-3 w-3" /> Tu Link de Netflix
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClip(generatedLink, setCopiedLink)}
                          className="h-7 px-3 text-[10px] text-white/40 hover:text-white/80 hover:bg-white/[0.06] rounded-lg transition-all duration-200 flex items-center gap-1.5"
                        >
                          {copiedLink ? <><Check className="h-3 w-3 text-emerald-400" /> <span className="text-emerald-400">Copiado</span></> : <><CopyIcon className="h-3 w-3" /> Copiar Link</>}
                        </button>
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-3 text-[10px] text-emerald-400/80 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all duration-200 flex items-center gap-1 font-medium"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/15 font-mono break-all leading-relaxed">{generatedLink}</p>
                  </div>
                </CardContent>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB 3: COPY COOKIE ═══ */}
          <TabsContent value="copy" className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-950/10 to-transparent pointer-events-none" />
              <CardHeader className="pb-3 px-5 pt-5 relative">
                <CardTitle className="text-violet-400 text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <RefreshCw className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  Generar Cookie de Netflix
                </CardTitle>
                <CardDescription className="text-white/25 text-xs ml-[38px]">
                  Genera una cookie funcional del servidor. Cuesta <span className="text-white/60 font-semibold">3 créditos</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5 relative">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#050508]/80 border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span className="text-white/40 text-sm">Tu saldo:</span>
                  </div>
                  <span className={`text-xl font-bold tabular-nums ${credits >= 3 ? "text-emerald-400" : "text-red-400"}`}>
                    {credits} <span className="text-xs text-white/20 font-normal">créditos</span>
                  </span>
                </div>

                <Button
                  onClick={handleCopyCookie}
                  disabled={copying || credits < 3}
                  className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold h-12 transition-all duration-300 disabled:opacity-40 rounded-xl shadow-[0_0_20px_rgba(167,139,250,0.15)] hover:shadow-[0_0_30px_rgba(167,139,250,0.25)] text-base"
                >
                  {copying ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Cookie...</>
                  ) : (
                    <><RefreshCw className="h-5 w-5 mr-2" /> Generar Cookie</>
                  )}
                </Button>

                {credits < 3 && (
                  <p className="text-red-400/40 text-xs text-center">
                    Necesitas al menos 3 créditos. Contacta al administrador.
                  </p>
                )}
              </CardContent>
            </div>

            {copiedCookie && (
              <div className="rounded-2xl border border-violet-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-[0_0_12px_rgba(167,139,250,0.1)]">
                        <Check className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-violet-400 font-semibold text-sm">Cookie Obtenida</p>
                        <p className="text-white/25 text-xs">Créditos restantes: {credits}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClip(copiedCookie, setCopiedCookieClip)}
                      className="px-4 py-2 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-xs font-medium rounded-xl transition-all duration-300 flex items-center gap-2 shadow-[0_0_15px_rgba(167,139,250,0.15)]"
                    >
                      {copiedCookieClip ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><CopyIcon className="h-3.5 w-3.5" /> Copiar Cookie</>}
                    </button>
                  </div>
                  <div className="bg-[#050508]/60 rounded-xl p-3 border border-white/[0.04]">
                    <p className="text-[10px] text-white/15 font-mono break-all leading-relaxed max-h-24 overflow-y-auto premium-scrollbar">
                      {copiedCookie}
                    </p>
                  </div>
                </CardContent>
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB 4: ACTIVAR TV ═══ */}
          <TabsContent value="tv" className="space-y-4">
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-rose-950/10 to-transparent pointer-events-none" />
              <CardHeader className="pb-3 px-5 pt-5 relative">
                <CardTitle className="text-rose-400 text-sm flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <MonitorPlay className="h-3.5 w-3.5 text-rose-400" />
                  </div>
                  Activar Netflix en TV
                </CardTitle>
                <CardDescription className="text-white/25 text-xs ml-[38px]">
                  Ingresa el código de 8 dígitos que aparece en tu TV. Se usa una cookie del servidor. Cuesta <span className="text-white/60 font-semibold">5 créditos</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-5 relative">
                {/* Info Steps */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#050508]/60 border border-white/[0.04]">
                  <div className="h-8 w-8 rounded-lg bg-rose-500/10 border border-rose-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Tv className="h-4 w-4 text-rose-400/70" />
                  </div>
                  <ol className="text-white/40 text-[11px] space-y-1 list-decimal list-inside">
                    <li>Abre Netflix en tu Smart TV o consola</li>
                    <li>Selecciona &quot;Iniciar sesión&quot; &rarr; &quot;Iniciar sesión en la web&quot;</li>
                    <li>Copia el código de 8 dígitos que aparece</li>
                    <li>Pégalo aquí y presiona Activar</li>
                  </ol>
                </div>

                {/* Code Input */}
                <div className="relative">
                  <Input
                    value={tvCode}
                    onChange={(e) => setTvCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="00000000"
                    className="bg-[#050508]/80 border-white/[0.06] text-white/90 placeholder:text-white/10 text-center text-2xl font-mono font-bold tracking-[0.5em] h-16 rounded-xl focus:border-rose-500/40 focus:ring-2 focus:ring-rose-500/10 transition-all duration-300"
                    maxLength={8}
                  />
                  {tvCode.length > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-white/15 text-[10px] font-mono">{tvCode.length}/8</span>
                    </div>
                  )}
                </div>

                {/* Balance */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#050508]/80 border border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-400" />
                    <span className="text-white/40 text-sm">Costo:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-bold text-lg tabular-nums">5</span>
                    <span className="text-white/20 text-xs">créditos</span>
                    <span className="text-white/10 mx-1">|</span>
                    <span className={`text-sm font-bold tabular-nums ${credits >= 5 ? "text-emerald-400" : "text-red-400"}`}>
                      {credits}
                    </span>
                    <span className="text-white/20 text-xs">disponibles</span>
                  </div>
                </div>

                {/* Activate Button */}
                <Button
                  onClick={handleTvActivate}
                  disabled={tvActivating || tvCode.length !== 8 || credits < 5}
                  className="w-full bg-gradient-to-r from-rose-600 via-red-500 to-rose-600 hover:from-rose-500 hover:via-red-400 hover:to-rose-500 text-white font-semibold h-12 transition-all duration-300 disabled:opacity-40 rounded-xl shadow-[0_0_20px_rgba(251,113,133,0.15)] hover:shadow-[0_0_30px_rgba(251,113,133,0.25)] text-base"
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

                {credits < 5 && (
                  <p className="text-red-400/40 text-xs text-center">
                    Necesitas al menos 5 créditos. Contacta al administrador.
                  </p>
                )}

                {/* Loading animation */}
                {tvActivating && (
                  <div className="rounded-xl border border-rose-500/10 bg-[#0a0a10]/60 overflow-hidden">
                    <div className="relative h-24 flex items-center justify-center overflow-hidden">
                      <div className="absolute inset-0 scan-line" />
                      <div className="relative flex flex-col items-center gap-2 z-10">
                        <div className="h-8 w-8 rounded-full border-2 border-rose-400/30 border-t-rose-400 animate-spin" />
                        <span className="text-rose-400/60 text-[10px] uppercase tracking-widest">Activando TV...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result */}
                {tvResult && !tvActivating && (
                  tvResult.success ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(52,211,153,0.1)]">
                            <Check className="h-5 w-5 text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-emerald-400 font-semibold text-sm">TV Activada</h4>
                            <p className="text-white/30 text-xs mt-1">Netflix en tu TV está listo. Disfruta.</p>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-red-500/20 bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(239,68,68,0.1)]">
                            <X className="h-5 w-5 text-red-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="text-red-400 font-semibold text-sm">Error al activar</h4>
                            <p className="text-white/25 text-xs mt-1">{tvResult.message}</p>
                            <button
                              onClick={() => setTvResult(null)}
                              className="mt-2 text-white/30 hover:text-white/50 text-[10px] transition-colors"
                            >
                              Intentar de nuevo
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  )
                )}
              </CardContent>
            </div>
          </TabsContent>
        </Tabs>

        {/* ═══ Gradient Section Divider ═══ */}
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#E50914]/30 to-transparent" />
        </div>

        {/* ═══ Referral Section — Premium Card ═══ */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-950/10 via-transparent to-amber-950/5" />
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/5 rounded-full blur-3xl" />
          <CardHeader className="pb-3 px-5 pt-5 relative">
            <CardTitle className="text-orange-300 text-sm flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                <Gift className="h-3.5 w-3.5 text-orange-400" />
              </div>
              Sistema de Referidos
            </CardTitle>
            <CardDescription className="text-white/25 text-xs ml-[38px]">
              Comparte tu código y gana <span className="text-white/60 font-semibold">+5 créditos</span> por cada persona que se registre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 relative">
            {/* Referral Code Display */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#050508]/80 border border-white/[0.06] rounded-xl px-4 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-white/20 text-[10px] uppercase tracking-widest">Tu código</p>
                  <p className="text-white/90 font-mono font-bold text-lg tracking-wider">{referralCode || "..."}</p>
                </div>
                <button
                  onClick={() => copyToClip(referralCode, setCodeCopied)}
                  disabled={!referralCode}
                  className="h-9 px-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-medium flex items-center gap-1.5 transition-all duration-300 disabled:opacity-30 shadow-[0_0_15px_rgba(234,88,12,0.15)]"
                >
                  {codeCopied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Share2 className="h-3.5 w-3.5" /> Copiar</>}
                </button>
              </div>
            </div>

            {canShareCode ? (
              <p className="text-emerald-400/50 text-[10px] text-center flex items-center justify-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                Tu código está activo y listo para compartir
              </p>
            ) : (
              <p className="text-amber-400/50 text-[10px] text-center flex items-center justify-center gap-1.5">
                <Clock className="h-3 w-3" />
                Tu código se activa en 10 minutos después del registro
              </p>
            )}

            {/* Stats Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#050508]/60 border border-white/[0.04] p-3 text-center">
                <p className="text-orange-300 font-bold text-xl tabular-nums">{totalReferrals}</p>
                <p className="text-white/20 text-[10px] uppercase tracking-widest mt-0.5">Referidos</p>
              </div>
              <div className="rounded-xl bg-[#050508]/60 border border-white/[0.04] p-3 text-center">
                <p className="text-amber-300 font-bold text-xl tabular-nums">{totalReferrals * 5}</p>
                <p className="text-white/20 text-[10px] uppercase tracking-widest mt-0.5">Créditos ganados</p>
              </div>
            </div>

            {/* Redeem Section */}
            <div className="relative pt-4">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
              <p className="text-white/40 text-xs font-medium mb-2.5 flex items-center gap-1.5">
                <Gift className="h-3 w-3 text-orange-400/60" /> ¿Tienes un código de referido?
              </p>
              <div className="flex gap-2">
                <Input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="NF-XXXXXX"
                  className="flex-1 bg-[#050508]/80 border-white/[0.06] text-white/80 placeholder:text-white/15 uppercase font-mono rounded-xl focus:border-orange-500/30 focus:ring-1 focus:ring-orange-500/10 transition-all duration-300 text-sm"
                />
                <Button
                  onClick={handleRedeem}
                  disabled={redeeming || !redeemCode.trim()}
                  className="bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-medium h-10 px-5 disabled:opacity-40 shrink-0 rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.15)] transition-all duration-300"
                >
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Canjear"}
                </Button>
              </div>
            </div>
          </CardContent>
        </div>

        {/* ═══ Gradient Section Divider ═══ */}
        <div className="relative h-px w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
        </div>

        {/* ═══ Buy Credits Notice ═══ */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/10 via-transparent to-sky-950/5" />
          <div className="absolute -top-16 -left-16 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
          <CardContent className="relative p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/15 to-sky-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Coins className="h-4.5 w-4.5 text-emerald-400" />
                </div>
                <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-semibold">¿Necesitas más créditos?</p>
                <p className="text-white/25 text-[11px]">Contacta al administrador para adquirir paquetes</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366]/5 hover:bg-[#25D366]/12 border border-[#25D366]/15 hover:border-[#25D366]/25 transition-all duration-300 text-[#25D366] text-xs font-semibold shadow-[0_0_15px_rgba(37,211,102,0.05)] hover:shadow-[0_0_25px_rgba(37,211,102,0.12)] group"
              >
                <svg className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#229ED9]/5 hover:bg-[#229ED9]/12 border border-[#229ED9]/15 hover:border-[#229ED9]/25 transition-all duration-300 text-[#229ED9] text-xs font-semibold shadow-[0_0_15px_rgba(34,158,217,0.05)] hover:shadow-[0_0_25px_rgba(34,158,217,0.12)] group"
              >
                <svg className="h-4 w-4 group-hover:scale-110 transition-transform duration-300" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
            <p className="text-white/15 text-[10px] text-center">
              Respuesta rápida. Paquetes a tu medida.
            </p>
          </CardContent>
        </div>

        {/* ═══ Transaction History ═══ */}
        <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a10]/60 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white/70 text-sm flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-[#E50914]" />
                </div>
                Historial de Transacciones
              </CardTitle>
              {transactions.length > 0 && (
                <button
                  onClick={() => { setTransactions([]); setHistoryCleared(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/60 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 text-[10px] font-medium"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar historial
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-1 max-h-[280px] overflow-y-auto premium-scrollbar">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <div className="h-10 w-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-white/15" />
                  </div>
                  <p className="text-white/15 text-xs">Sin actividad aún</p>
                </div>
              ) : (
                transactions.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-3 rounded-xl transition-all duration-200 hover:bg-white/[0.03] ${
                      i % 2 === 0 ? "bg-transparent" : "bg-white/[0.015]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        t.credits >= 0
                          ? "bg-emerald-500/10 border border-emerald-500/15"
                          : "bg-red-500/10 border border-red-500/15"
                      }`}>
                        {t.credits >= 0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-emerald-400 rotate-180" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-white/60 text-xs font-medium">{t.description || t.type}</p>
                        <p className="text-white/15 text-[10px] flex items-center gap-1">
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
      <footer className="border-t border-white/[0.04] bg-[#050508] mt-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col items-center gap-4">
            <GradientDivider />
            <p className="text-white/20 text-[10px] tracking-wide">
              Netflix Cookie Checker Pro — Desarrollado por <span className="text-white/40 font-semibold">HacheJota</span>
            </p>
            <div className="flex items-center gap-2">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all duration-300 text-white/30 hover:text-white/60 text-[10px]"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-all duration-300 text-white/30 hover:text-white/60 text-[10px]"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
            <p className="text-white/10 text-[9px]">
              Uso privado únicamente. No afiliado a Netflix, Inc.
            </p>
          </div>
        </div>
      </footer>

      {/* ─── Global Premium Styles ─── */}
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
          50% { box-shadow: 0 0 12px rgba(251,191,36,0.08); }
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
