"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
  Zap,
  Copy,
  LogOut,
  Coins,
  Loader2,
  Check,
  ExternalLink,
  AlertTriangle,
  CreditCard,
  Clock,
  TrendingDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string;
  type: string;
  credits: number;
  description: string | null;
  createdAt: string;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [credits, setCredits] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Generate token
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");

  // Copy cookie
  const [copying, setCopying] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState("");
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // ── Auth Check ──
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          router.push("/login");
        } else if (data.user.role === "ADMIN") {
          router.push("/admin");
        } else {
          setUsername(data.user.username);
          setCredits(data.user.credits);
          loadBalance();
          setLoading(false);
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/user/balance");
      const data = await res.json();
      if (data.success) {
        setCredits(data.credits);
        setTransactions(data.transactions || []);
      }
    } catch {}
  }, []);

  // ── Generate Token (1 credit) ──
  const handleGenerate = useCallback(async () => {
    if (credits < 1) {
      toast.error("Créditos insuficientes. Pide más al administrador.");
      return;
    }

    setGenerating(true);
    setGeneratedLink("");
    setGeneratedToken("");

    try {
      const res = await fetch("/api/user/generate", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setGeneratedLink(data.link);
        setGeneratedToken(data.token);
        setCredits(data.remainingCredits);
        toast.success("Token generado exitosamente");
        loadBalance();
      } else {
        if (data.noCookies) {
          toast.error("No hay cookies disponibles. Se ha notificado al administrador.");
        } else if (data.retry) {
          toast.error("Cookie dañada, intenta de nuevo...");
        } else {
          toast.error(data.error || "Error al generar token");
        }
        // Refresh credits
        loadBalance();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setGenerating(false);
    }
  }, [credits, loadBalance]);

  // ── Copy Cookie (3 credits) ──
  const handleCopyCookie = useCallback(async () => {
    if (credits < 3) {
      toast.error("Créditos insuficientes. Necesitas 3 créditos para copiar una cookie.");
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
        toast.success("Cookie copiada exitosamente");
        loadBalance();
      } else {
        if (data.noCookies) {
          toast.error("No hay cookies disponibles. Se ha notificado al administrador.");
        } else if (data.retry) {
          toast.error("Cookie dañada, intenta de nuevo...");
        } else {
          toast.error(data.error || "Error al copiar cookie");
        }
        loadBalance();
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCopying(false);
    }
  }, [credits, loadBalance]);

  // ── Copy to clipboard ──
  const copyText = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToClipboard(true);
      toast.success("Copiado al portapapeles");
      setTimeout(() => setCopiedToClipboard(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  }, []);

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
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#E50914] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Netflix Checker
                <span className="text-[#E50914] ml-1">Pro</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-yellow-800 text-yellow-400 text-xs">
              <Coins className="h-3 w-3 mr-1" />
              {credits} créditos
            </Badge>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Welcome */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Bienvenido, <span className="text-[#E50914]">{username}</span></h2>
          <p className="text-gray-500 text-sm mt-1">Genera tokens o copia cookies de Netflix</p>
        </div>

        {/* Credit Info */}
        <Card className="border-yellow-900/30 bg-yellow-950/10">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-yellow-950/50 flex items-center justify-center">
                <Coins className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-yellow-400 font-bold text-lg">{credits}</p>
                <p className="text-yellow-600/60 text-xs">Créditos disponibles</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gray-500 text-xs flex items-center gap-1">
                <Zap className="h-3 w-3" /> Generar Token: <span className="text-white font-semibold">1 crédito</span>
              </p>
              <p className="text-gray-500 text-xs flex items-center gap-1 mt-1">
                <Copy className="h-3 w-3" /> Copiar Cookie: <span className="text-white font-semibold">3 créditos</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Generate Token */}
          <Card className="border-green-900/30 bg-[#1F1F1F] hover:border-green-800/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-400 text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Generar Token
              </CardTitle>
              <CardDescription className="text-gray-500 text-xs">
                Genera un link de acceso a Netflix. Cuesta 1 crédito.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerate}
                disabled={generating || credits < 1}
                className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold h-11 disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</>
                ) : (
                  <><Zap className="h-4 w-4 mr-2" /> Generar Token (1 crédito)</>
                )}
              </Button>

              {generatedLink && (
                <div className="mt-3 space-y-2">
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400 font-semibold">NFToken Link</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => copyText(generatedLink)}
                          className="h-6 px-2 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          {copiedToClipboard ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                        <a
                          href={generatedLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-6 px-2 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10 inline-flex items-center transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">{generatedLink}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Copy Cookie */}
          <Card className="border-purple-900/30 bg-[#1F1F1F] hover:border-purple-800/50 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                <Copy className="h-4 w-4" />
                Copiar Cookie
              </CardTitle>
              <CardDescription className="text-gray-500 text-xs">
                Copia una cookie funcional de Netflix. Cuesta 3 créditos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleCopyCookie}
                disabled={copying || credits < 3}
                className="w-full bg-purple-700 hover:bg-purple-600 text-white font-semibold h-11 disabled:opacity-50"
              >
                {copying ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Obteniendo...</>
                ) : (
                  <><Copy className="h-4 w-4 mr-2" /> Copiar Cookie (3 créditos)</>
                )}
              </Button>

              {copiedCookie && (
                <div className="mt-3">
                  <div className="bg-black/40 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-purple-400 font-semibold">Cookie</span>
                      <button
                        onClick={() => copyText(copiedCookie)}
                        className="h-6 px-2 rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                      >
                        {copiedToClipboard ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed max-h-20 overflow-y-auto custom-scrollbar">
                      {copiedCookie}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <Card className="border-white/10 bg-[#1F1F1F]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#E50914]" />
              Historial de Créditos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
              {transactions.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">Sin actividad</p>
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
        <div className="max-w-2xl mx-auto px-4 py-6">
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
      `}</style>
    </div>
  );
}
