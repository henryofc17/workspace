"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Shield,
  Search,
  Zap,
  Copy,
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
} from "lucide-react";

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

function MetaRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
}) {
  if (!value && value !== 0) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-gray-500 shrink-0" />
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [credits, setCredits] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [cookieText, setCookieText] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkerResult, setCheckerResult] =
    useState<CheckerResult | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const [copying, setCopying] = useState(false);
  const [copiedCookie, setCopiedCookie] = useState("");
  const [copiedCookieClip, setCopiedCookieClip] =
    useState(false);

  const loadBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/user/balance", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setCredits(data.credits);
        setTransactions(data.transactions || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json();

        if (!mounted) return;

        if (!res.ok || !data.success) {
          window.location.href = "/login";
          return;
        }

        if (data.user.role === "ADMIN") {
          window.location.href = "/admin";
          return;
        }

        setUsername(data.user.username);
        setCredits(data.user.credits);

        await loadBalance();

        setLoading(false);
      } catch {
        if (mounted) {
          window.location.href = "/login";
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [loadBalance]);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json();

      if (data.success) {
        setCredits(data.user.credits);
      }
    } catch {}
  }, []);

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
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          cookieText: cookieText.trim(),
        }),
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

  const handleGenerate = useCallback(async () => {
    if (credits < 1) {
      toast.error("Créditos insuficientes");
      return;
    }

    setGenerating(true);
    setGeneratedLink("");

    try {
      const res = await fetch("/api/user/generate", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedLink(data.link);
        setCredits(data.remainingCredits);
        await refreshCredits();
        await loadBalance();
        toast.success("Token generado");
      } else {
        toast.error(data.error || "Error");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setGenerating(false);
    }
  }, [credits, loadBalance, refreshCredits]);

  const handleCopyCookie = useCallback(async () => {
    if (credits < 3) {
      toast.error("Necesitas 3 créditos");
      return;
    }

    setCopying(true);
    setCopiedCookie("");

    try {
      const res = await fetch("/api/user/copy-cookie", {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();

      if (data.success) {
        setCopiedCookie(data.cookie);
        setCredits(data.remainingCredits);
        await refreshCredits();
        await loadBalance();
        toast.success("Cookie obtenida");
      } else {
        toast.error(data.error || "Error");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCopying(false);
    }
  }, [credits, loadBalance, refreshCredits]);

  const copyToClip = useCallback(
    async (text: string, setter: (v: boolean) => void) => {
      try {
        await navigator.clipboard.writeText(text);
        setter(true);
        toast.success("Copiado");

        setTimeout(() => setter(false), 2000);
      } catch {
        toast.error("No se pudo copiar");
      }
    },
    []
  );

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    window.location.href = "/login";
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
      <Card className="bg-[#171717] border-white/10 w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="text-[#E50914]" />
            Netflix Checker Pro
          </CardTitle>

          <CardDescription>
            Bienvenido {username}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-yellow-400 font-bold">
            Créditos: {credits}
          </div>

          <Button
            onClick={handleLogout}
            className="w-full bg-red-600"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
