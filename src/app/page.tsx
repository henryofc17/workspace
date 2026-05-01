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
  RefreshCw,
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

// ─── Metadata Row ────────────────────────────────────────────────────────────

function MetaRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-500 shrink-0" />
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-medium">{value}</span>
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
        setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#141414]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#E50914] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Netflix Checker<span className="text-[#E50914] ml-1">Pro</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 bg-yellow-950/30 border border-yellow-900/20 rounded-full px-3 py-1.5">
              <Coins className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-yellow-400 text-sm font-bold">{credits}</span>
            </div>
            <span className="text-gray-500 text-sm hidden sm:inline">{username}</span>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8 w-8 p-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Credit Banner */}
        <Card className="border-yellow-900/20 bg-gradient-to-r from-yellow-950/20 to-orange-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-yellow-950/50 border border-yellow-900/30 flex items-center justify-center">
                <Coins className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 font-bold text-xl">{credits}</p>
                <p className="text-yellow-700/60 text-xs">Créditos disponibles</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-gray-400 text-xs">Generar Token: <span className="text-white font-semibold">1 crédito</span></span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-gray-400 text-xs">Generar Cookie: <span className="text-white font-semibold">3 créditos</span></span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-gray-400 text-xs">Checker: <span className="text-white font-semibold">Gratis</span></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="checker" className="space-y-6">
          <TabsList className="bg-[#1F1F1F] border border-white/10 w-full h-auto p-1">
            <TabsTrigger
              value="checker"
              className="flex-1 py-2.5 text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white text-gray-400 transition-all"
            >
              <Search className="h-4 w-4 mr-2" />
              Checker
            </TabsTrigger>
            <TabsTrigger
              value="generate"
              className="flex-1 py-2.5 text-sm data-[state=active]:bg-green-600 data-[state=active]:text-white text-gray-400 transition-all"
            >
              <Zap className="h-4 w-4 mr-2" />
              Generar Token
            </TabsTrigger>
            <TabsTrigger
              value="copy"
              className="flex-1 py-2.5 text-sm data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-400 transition-all"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Generar Cookie
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB 1: CHECKER ═══ */}
          <TabsContent value="checker" className="space-y-4">
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-400" />
                  Verificar Cookie Individual
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Pega tu cookie de Netflix para verificarla y extraer metadatos. Completamente gratis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                  placeholder="Pega tu cookie aquí...&#10;&#10;Ejemplo: NetflixId=v1%3B...; SecureNetflixId=v2%3B...; nfvdid=..."
                  className="bg-[#0a0a0a] border-white/10 text-white text-sm font-mono placeholder:text-gray-600 min-h-[120px] resize-y focus:border-blue-500/50"
                />
                <Button
                  onClick={handleCheck}
                  disabled={checking || !cookieText.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold h-11 transition-colors disabled:opacity-50"
                >
                  {checking ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando...</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Verificar Cookie</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {checking && (
              <div className="space-y-3">
                <Skeleton className="h-28 w-full bg-[#1F1F1F] rounded-xl" />
                <Skeleton className="h-16 w-full bg-[#1F1F1F] rounded-xl" />
              </div>
            )}

            {checkerResult && !checking && (
              checkerResult.success ? (
                <Card className="border-green-900/40 bg-[#0d1a0d]">
                  <CardHeader className="pb-3 px-4 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-green-950/50 flex items-center justify-center shrink-0">
                          <Shield className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-green-400 text-sm">Cookie Válida</CardTitle>
                          <CardDescription className="text-green-600/60 text-xs">
                            {checkerResult.metadata?.plan || "Plan Desconocido"}
                            {checkerResult.metadata?.countryName ? ` • ${checkerResult.metadata.countryName}` : ""}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-green-800 text-green-400 text-[10px]">
                        {checkerResult.metadata?.status || "Activa"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {checkerResult.link && (
                      <div className="bg-black/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3" /> NFToken
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClip(checkerResult.link!, setCopiedLink)}
                              className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                            >
                              {copiedLink ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                            <a href={checkerResult.link} target="_blank" rel="noopener noreferrer"
                              className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/10 inline-flex items-center rounded transition-colors">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">{checkerResult.link}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <MetaRow icon={Globe} label="País" value={checkerResult.metadata?.countryName || checkerResult.metadata?.country} />
                      <MetaRow icon={Tv} label="Plan" value={checkerResult.metadata?.plan} />
                      <MetaRow icon={Mail} label="Email" value={checkerResult.metadata?.email} />
                      <MetaRow icon={Calendar} label="Desde" value={checkerResult.metadata?.memberSince} />
                      <MetaRow icon={Calendar} label="Próx. Cobro" value={checkerResult.metadata?.nextBilling} />
                      <MetaRow icon={CreditCard} label="Pago" value={checkerResult.metadata?.paymentMethod} />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-red-900/40 bg-[#1a1010]">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center shrink-0">
                        <X className="h-5 w-5 text-red-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-red-400 font-semibold text-sm">Cookie Inválida</h4>
                        <p className="text-red-300/60 text-xs mt-1">{checkerResult.error || "Error desconocido"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </TabsContent>

          {/* ═══ TAB 2: GENERATE TOKEN ═══ */}
          <TabsContent value="generate" className="space-y-4">
            <Card className="border-green-900/30 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-400 text-base flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Generar Token de Netflix
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Se usa una cookie del servidor para generar tu link de acceso. Cuesta <span className="text-white font-semibold">1 crédito</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border border-white/5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-400" />
                    <span className="text-gray-400 text-sm">Tu saldo:</span>
                  </div>
                  <span className={`text-lg font-bold ${credits >= 1 ? "text-green-400" : "text-red-400"}`}>
                    {credits} <span className="text-xs text-gray-500 font-normal">créditos</span>
                  </span>
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={generating || credits < 1}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold h-12 transition-colors disabled:opacity-50 text-base"
                >
                  {generating ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Token...</>
                  ) : (
                    <><Zap className="h-5 w-5 mr-2" /> Generar Token</>
                  )}
                </Button>

                {credits < 1 && (
                  <p className="text-red-400/60 text-xs text-center">
                    Créditos insuficientes. Contacta al administrador para obtener más.
                  </p>
                )}
              </CardContent>
            </Card>

            {generatedLink && (
              <Card className="border-green-900/40 bg-[#0d1a0d]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-green-950/50 flex items-center justify-center">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-green-400 font-semibold text-sm">Token Generado</p>
                      <p className="text-green-600/60 text-xs">Créditos restantes: {credits}</p>
                    </div>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Tu Link de Netflix
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyToClip(generatedLink, setCopiedLink)}
                          className="h-7 px-3 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1"
                        >
                          {copiedLink ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar Link</>}
                        </button>
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-7 px-3 text-xs text-green-400 hover:text-green-300 hover:bg-green-950/30 rounded-md transition-colors flex items-center gap-1 font-medium"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">{generatedLink}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ═══ TAB 3: COPY COOKIE ═══ */}
          <TabsContent value="copy" className="space-y-4">
            <Card className="border-purple-900/30 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-400 text-base flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Generar Cookie de Netflix
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Genera una cookie funcional del servidor. Cuesta <span className="text-white font-semibold">3 créditos</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a] border border-white/5">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-400" />
                    <span className="text-gray-400 text-sm">Tu saldo:</span>
                  </div>
                  <span className={`text-lg font-bold ${credits >= 3 ? "text-green-400" : "text-red-400"}`}>
                    {credits} <span className="text-xs text-gray-500 font-normal">créditos</span>
                  </span>
                </div>

                <Button
                  onClick={handleCopyCookie}
                  disabled={copying || credits < 3}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold h-12 transition-colors disabled:opacity-50 text-base"
                >
                  {copying ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generando Cookie...</>
                  ) : (
                    <><RefreshCw className="h-5 w-5 mr-2" /> Generar Cookie</>
                  )}
                </Button>

                {credits < 3 && (
                  <p className="text-red-400/60 text-xs text-center">
                    Necesitas al menos 3 créditos. Contacta al administrador.
                  </p>
                )}
              </CardContent>
            </Card>

            {copiedCookie && (
              <Card className="border-purple-900/40 bg-[#120d1a]">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-purple-950/50 flex items-center justify-center">
                        <Check className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-purple-400 font-semibold text-sm">Cookie Obtenida</p>
                        <p className="text-purple-600/60 text-xs">Créditos restantes: {credits}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClip(copiedCookie, setCopiedCookieClip)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      {copiedCookieClip ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar Cookie</>}
                    </button>
                  </div>
                  <div className="bg-black/40 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                      {copiedCookie}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Referral Section */}
        <Card className="border-orange-900/20 bg-gradient-to-r from-orange-950/10 to-yellow-950/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Sistema de Referidos
            </CardTitle>
            <CardDescription className="text-gray-500 text-xs">
              Comparte tu código y gana <span className="text-white font-semibold">+5 créditos</span> por cada persona que se registre.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Your Code */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-[10px]">Tu código</p>
                  <p className="text-white font-mono font-bold text-lg tracking-wider">{referralCode || "..."}</p>
                </div>
                <button
                  onClick={() => copyToClip(referralCode, setCodeCopied)}
                  disabled={!referralCode}
                  className="h-9 px-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {codeCopied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Share2 className="h-3.5 w-3.5" /> Copiar</>}
                </button>
              </div>
            </div>

            {canShareCode ? (
              <p className="text-green-400/60 text-[10px] text-center flex items-center justify-center gap-1">
                <Check className="h-3 w-3" /> Tu código está activo y listo para compartir
              </p>
            ) : (
              <p className="text-yellow-400/60 text-[10px] text-center">
                Tu código se activa en 1 hora después del registro
              </p>
            )}

            <div className="flex items-center justify-center gap-4 text-center">
              <div>
                <p className="text-orange-400 font-bold text-lg">{totalReferrals}</p>
                <p className="text-gray-600 text-[10px]">Referidos</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="text-yellow-400 font-bold text-lg">{totalReferrals * 5}</p>
                <p className="text-gray-600 text-[10px]">Créditos ganados</p>
              </div>
            </div>

            {/* Redeem Code */}
            <div className="border-t border-white/5 pt-4">
              <p className="text-gray-400 text-xs font-medium mb-2 flex items-center gap-1">
                <Gift className="h-3 w-3" /> ¿Tienes un código de referido?
              </p>
              <div className="flex gap-2">
                <Input
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  placeholder="NF-XXXXXX"
                  className="flex-1 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 uppercase font-mono"
                />
                <Button
                  onClick={handleRedeem}
                  disabled={redeeming || !redeemCode.trim()}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-medium h-10 px-4 disabled:opacity-50 shrink-0"
                >
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Canjear"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buy Credits Notice */}
        <Card className="border-blue-900/20 bg-blue-950/5">
          <CardContent className="p-4">
            <p className="text-gray-400 text-xs text-center mb-2">
              ¿Necesitas más créditos? Contacta al administrador:
            </p>
            <div className="flex items-center justify-center gap-2">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors text-[#25D366] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 transition-colors text-[#229ED9] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Transaction History */}
        <Card className="border-white/10 bg-[#1F1F1F]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#E50914]" />
              Historial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
              {transactions.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">Sin actividad aún</p>
              ) : (
                transactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0a0a0a]">
                    <div className="flex items-center gap-2">
                      {t.credits >= 0 ? (
                        <TrendingDown className="h-4 w-4 text-green-400 rotate-180" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-400" />
                      )}
                      <div>
                        <p className="text-white text-xs font-medium">{t.description || t.type}</p>
                        <p className="text-gray-600 text-[10px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(t.createdAt).toLocaleString("es")}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${t.credits >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {t.credits >= 0 ? "+" : ""}{t.credits}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-500 text-xs">
              Netflix Cookie Checker Pro — Desarrollado por <span className="text-white font-semibold">HacheJota</span>
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors text-[#25D366] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 transition-colors text-[#229ED9] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
            <p className="text-gray-700 text-[10px]">
              Uso privado únicamente. No afiliado a Netflix, Inc.
            </p>
          </div>
        </div>
      </footer>

      {/* Global Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
        [role="progressbar"] > div { background-color: #E50914 !important; }
      `}</style>
    </div>
  );
}
