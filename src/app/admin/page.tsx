"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  Users,
  Cookie,
  CreditCard,
  LogOut,
  Plus,
  Trash2,
  Upload,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Coins,
  TrendingUp,
  UserCircle,
  Inbox,
  FileText,
  Zap,
  Crown,
  Activity,
  Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminStats {
  totalUsers: number;
  totalCookies: number;
  activeCookies: number;
  deadCookies: number;
  totalTransactions: number;
  allCookiesDead: boolean;
}

interface UserRecord {
  id: string;
  username: string;
  role: string;
  credits: number;
  createdAt: string;
  _count: { transactions: number };
}

interface CookieRecord {
  id: string;
  rawCookie: string;
  status: string;
  usedCount: number;
  lastUsed: string | null;
  lastError: string | null;
  country: string | null;
  plan: string | null;
  createdAt: string;
}

interface TransactionRecord {
  id: string;
  type: string;
  credits: number;
  description: string | null;
  createdAt: string;
  user: { username: string };
}

// ─── Animated Counter Hook ──────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevTarget.current = target;
  }, [target, duration]);

  return count;
}

// ─── Premium Stat Card ──────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  delay?: number;
}) {
  const animatedValue = useAnimatedCounter(value);

  const gradientMap: Record<string, { bg: string; icon: string; ring: string; text: string }> = {
    blue: {
      bg: "from-blue-600/20 to-cyan-600/10",
      icon: "from-blue-500 to-cyan-400",
      ring: "ring-blue-500/20",
      text: "text-blue-400",
    },
    green: {
      bg: "from-emerald-600/20 to-green-600/10",
      icon: "from-emerald-500 to-green-400",
      ring: "ring-emerald-500/20",
      text: "text-emerald-400",
    },
    red: {
      bg: "from-red-600/20 to-rose-600/10",
      icon: "from-red-500 to-rose-400",
      ring: "ring-red-500/20",
      text: "text-red-400",
    },
    yellow: {
      bg: "from-amber-600/20 to-yellow-600/10",
      icon: "from-amber-500 to-yellow-400",
      ring: "ring-amber-500/20",
      text: "text-amber-400",
    },
  };

  const scheme = gradientMap[color] || gradientMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300"
    >
      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${scheme.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${scheme.icon} flex items-center justify-center shadow-lg ${scheme.ring} ring-1`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${scheme.icon} opacity-60`} />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
          <p className="text-3xl font-bold text-white tabular-nums tracking-tight">{animatedValue.toLocaleString()}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Admin Page ──────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [cookies, setCookies] = useState<CookieRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);

  // Create user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCredits, setNewCredits] = useState("0");
  const [creatingUser, setCreatingUser] = useState(false);

  // Credit form
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDesc, setCreditDesc] = useState("");
  const [updatingCredits, setUpdatingCredits] = useState(false);

  // Upload
  const [uploadingCookies, setUploadingCookies] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Active tab
  const [tab, setTab] = useState<"dashboard" | "users" | "cookies">("dashboard");

  // ── Auth Check ──
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success || data.user.role !== "ADMIN") {
          router.push("/login");
        } else {
          loadData();
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, usersRes, cookiesRes] = await Promise.all([
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
        fetch("/api/admin/cookies").then((r) => r.json()),
      ]);

      if (statsRes.success) {
        setStats(statsRes.stats);
        setTransactions(statsRes.recentTransactions || []);
      }
      if (usersRes.success) setUsers(usersRes.users);
      if (cookiesRes.success) setCookies(cookiesRes.cookies);
    } catch {}
    setLoading(false);
  }, []);

  // ── Create User ──
  const handleCreateUser = useCallback(async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Usuario y contraseña requeridos");
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword, credits: Number(newCredits) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(`Usuario "${data.user.username}" creado con ${data.user.credits} créditos`);
      setNewUsername("");
      setNewPassword("");
      setNewCredits("0");
      loadData();
    } catch {
      toast.error("Error al crear usuario");
    } finally {
      setCreatingUser(false);
    }
  }, [newUsername, newPassword, newCredits, loadData]);

  // ── Delete User ──
  const handleDeleteUser = useCallback(async (userId: string, username: string) => {
    if (!confirm(`¿Eliminar usuario "${username}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Usuario "${username}" eliminado`);
        loadData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al eliminar");
    }
  }, [loadData]);

  // ── Update Credits ──
  const handleUpdateCredits = useCallback(async () => {
    if (!creditUserId || !creditAmount) {
      toast.error("Selecciona usuario y cantidad");
      return;
    }
    setUpdatingCredits(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: creditUserId,
          amount: Number(creditAmount),
          description: creditDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(`Créditos actualizados: ${data.user.username} → ${data.user.credits}`);
      setCreditAmount("");
      setCreditDesc("");
      loadData();
    } catch {
      toast.error("Error al actualizar créditos");
    } finally {
      setUpdatingCredits(false);
    }
  }, [creditUserId, creditAmount, creditDesc, loadData]);

  // ── Upload Cookies ──
  const handleUploadCookies = useCallback(async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Selecciona un archivo");
      return;
    }
    setUploadingCookies(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/cookies", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(data.message);
      loadData();
    } catch {
      toast.error("Error al subir cookies");
    } finally {
      setUploadingCookies(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [loadData]);

  // ── Refresh Cookies ──
  const handleRefreshCookies = useCallback(async () => {
    if (!confirm("¿Validar todas las cookies activas? Esto puede tardar varios minutos.")) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/refresh-cookies?active=true", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const r = data.results;
        toast.success(`Validación: ${r.alive} vivas, ${r.dead} muertas (${r.checked} revisadas)`);
        loadData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al refrescar cookies");
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  // ── Clean Dead Cookies ──
  const handleCleanDead = useCallback(async () => {
    if (!confirm("¿Eliminar todas las cookies muertas?")) return;
    try {
      const res = await fetch("/api/admin/cookies?type=dead", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.deleted} cookies muertas eliminadas`);
        loadData();
      }
    } catch {
      toast.error("Error");
    }
  }, [loadData]);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  // Tab config
  const tabs = [
    { key: "dashboard" as const, label: "Dashboard", icon: Activity },
    { key: "users" as const, label: "Usuarios", icon: Users },
    { key: "cookies" as const, label: "Cookies", icon: Cookie },
  ];

  const tabIndex = tabs.findIndex((t) => t.key === tab);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-red-500/20">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 animate-ping opacity-20" />
        </motion.div>
        <p className="text-white/30 text-sm font-medium tracking-wide">Cargando panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white antialiased">
      {/* ── Premium Scrollbar Styles ── */}
      <style jsx global>{`
        .premium-scroll::-webkit-scrollbar { width: 5px; }
        .premium-scroll::-webkit-scrollbar-track { background: transparent; }
        .premium-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .premium-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animated-gradient {
          background-size: 200% 200%;
          animation: gradient-shift 6s ease infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.8); }
        }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes alert-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.1); }
          50% { box-shadow: 0 0 40px rgba(239,68,68,0.2); }
        }
        .alert-glow { animation: alert-glow 3s ease-in-out infinite; }
        .premium-input::placeholder { color: rgba(255,255,255,0.2); }
        .premium-input:focus { box-shadow: 0 0 0 2px rgba(239,68,68,0.15), 0 0 20px rgba(239,68,68,0.05); }
        .premium-select option { background: #0d0d12; color: white; }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50">
        <div className="animated-gradient bg-gradient-to-r from-[#0c0c14] via-[#1a0a10] to-[#0c0c14] border-b border-white/[0.06]">
          <div className="backdrop-blur-2xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              {/* Left: Logo + Title */}
              <div className="flex items-center gap-3">
                {/* Logo */}
                <img
                  src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
                  alt="Logo"
                  className="h-9 w-auto rounded-lg object-contain"
                />
                <div className="hidden sm:block h-6 w-px bg-white/10" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold text-white tracking-tight">
                      Panel Admin
                    </h1>
                    <Badge className="bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold px-2 py-0.5 h-5">
                      <Shield className="h-3 w-3 mr-1" />
                      ADMIN ONLY
                    </Badge>
                  </div>
                  <p className="text-[10px] text-white/25 font-medium tracking-wider uppercase">
                    Netflix Cookie Checker Pro
                  </p>
                </div>
              </div>

              {/* Right: Alerts + Logout */}
              <div className="flex items-center gap-2">
                {stats?.allCookiesDead && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-semibold px-2.5 py-0.5 h-6 cursor-default">
                      <span className="relative flex h-2 w-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      Sin cookies activas
                    </Badge>
                  </motion.div>
                )}
                <button
                  onClick={handleLogout}
                  className="h-9 w-9 rounded-xl border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-12">
        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="relative flex bg-white/[0.03] backdrop-blur-xl p-1 rounded-2xl border border-white/[0.06]">
          {/* Animated indicator */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/10 border border-red-500/20 shadow-lg shadow-red-500/5"
            animate={{
              left: `${(tabIndex / tabs.length) * 100}%`,
              width: `${100 / tabs.length}%`,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 ${
                tab === key ? "text-white" : "text-white/35 hover:text-white/60"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ═══ DASHBOARD ═══ */}
        <AnimatePresence mode="wait">
          {tab === "dashboard" && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard icon={Users} label="Usuarios" value={stats?.totalUsers || 0} color="blue" delay={0} />
                <StatCard icon={Cookie} label="Cookies Activas" value={stats?.activeCookies || 0} color="green" delay={0.05} />
                <StatCard icon={X} label="Cookies Muertas" value={stats?.deadCookies || 0} color="red" delay={0.1} />
                <StatCard icon={Coins} label="Transacciones" value={stats?.totalTransactions || 0} color="yellow" delay={0.15} />
              </div>

              {/* Dead Cookies Alert */}
              {stats?.allCookiesDead && stats.totalCookies > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alert-glow rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.07] to-orange-500/[0.03] backdrop-blur-xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="relative mt-0.5">
                      <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-red-400 font-semibold text-sm">Todas las cookies están muertas</h3>
                      <p className="text-red-300/40 text-xs mt-1.5 leading-relaxed">
                        Sube nuevas cookies para que los usuarios puedan generar tokens. Las cookies se validan automáticamente.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Recent Transactions */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">Transacciones Recientes</h2>
                      <p className="text-[10px] text-white/25 font-medium">{transactions.length} registros</p>
                    </div>
                  </div>
                </div>
                <div className="p-2 premium-scroll max-h-[420px] overflow-y-auto">
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-white/15" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/25 text-sm font-medium">Sin transacciones</p>
                        <p className="text-white/10 text-xs mt-1">Las transacciones aparecerán aquí</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {transactions.map((t) => (
                        <motion.div
                          key={t.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                              t.credits >= 0
                                ? "bg-emerald-500/10"
                                : "bg-red-500/10"
                            }`}>
                              {t.credits >= 0
                                ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                                : <TrendingUp className="h-3.5 w-3.5 text-red-400 rotate-180" />
                              }
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white/80 text-sm font-medium truncate">{t.user.username}</span>
                                <Badge className={`text-[9px] font-bold px-1.5 py-0 h-4 border-0 ${
                                  t.credits >= 0
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}>
                                  {t.type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-sm font-bold tabular-nums ${
                              t.credits >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}>
                              {t.credits >= 0 ? "+" : ""}{t.credits}
                            </span>
                            <span className="text-white/15 text-[10px] font-medium">
                              {new Date(t.createdAt).toLocaleDateString("es")}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ USERS ═══ */}
          {tab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* Create User Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">Crear Usuario</h2>
                      <p className="text-[10px] text-white/25 font-medium">Nuevo usuario del sistema</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Usuario</label>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="nombre_usuario"
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Contraseña</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Créditos Iniciales</label>
                    <input
                      type="number"
                      value={newCredits}
                      onChange={(e) => setNewCredits(e.target.value)}
                      placeholder="0"
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  <button
                    onClick={handleCreateUser}
                    disabled={creatingUser || !newUsername.trim() || !newPassword.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {creatingUser ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Crear Usuario
                  </button>
                </div>
              </div>

              {/* Manage Credits Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-500/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">Gestión de Créditos</h2>
                      <p className="text-[10px] text-white/25 font-medium">Añadir o quitar créditos</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Usuario</label>
                    <select
                      value={creditUserId}
                      onChange={(e) => setCreditUserId(e.target.value)}
                      className="premium-select premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300 appearance-none"
                    >
                      <option value="">Seleccionar usuario...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.username} ({u.credits} créditos)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Cantidad</label>
                    <input
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder="+100 o -50"
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Descripción</label>
                    <input
                      value={creditDesc}
                      onChange={(e) => setCreditDesc(e.target.value)}
                      placeholder="Opcional..."
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  <button
                    onClick={handleUpdateCredits}
                    disabled={updatingCredits || !creditUserId || !creditAmount}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    {updatingCredits ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Coins className="h-4 w-4" />
                    )}
                    Actualizar Créditos
                  </button>
                </div>
              </div>

              {/* Users List Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden lg:col-span-2">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">
                        Todos los Usuarios
                        <span className="text-white/20 ml-1.5 font-normal">({users.length})</span>
                      </h2>
                    </div>
                  </div>
                </div>
                <div className="p-2 premium-scroll max-h-[440px] overflow-y-auto">
                  {users.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <UserCircle className="h-6 w-6 text-white/15" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/25 text-sm font-medium">Sin usuarios</p>
                        <p className="text-white/10 text-xs mt-1">Crea el primer usuario arriba</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {users.map((u) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-all duration-200"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Avatar */}
                            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm ${
                              u.role === "ADMIN"
                                ? "bg-gradient-to-br from-red-500/20 to-orange-500/10 text-red-400 border border-red-500/20"
                                : "bg-gradient-to-br from-blue-500/15 to-cyan-500/10 text-blue-400 border border-blue-500/10"
                            }`}>
                              {u.username[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white/90 text-sm font-semibold truncate">{u.username}</span>
                                {u.role === "ADMIN" ? (
                                  <Badge className="bg-gradient-to-r from-red-500/15 to-orange-500/10 text-red-400 border border-red-500/15 text-[9px] font-bold px-1.5 py-0 h-4 flex items-center gap-0.5">
                                    <Crown className="h-2.5 w-2.5" />
                                    ADMIN
                                  </Badge>
                                ) : (
                                  <Badge className="bg-white/[0.04] text-white/30 border border-white/[0.06] text-[9px] font-bold px-1.5 py-0 h-4">
                                    USER
                                  </Badge>
                                )}
                              </div>
                              <p className="text-white/20 text-[11px] mt-0.5">{u._count.transactions} transacciones</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/5 border border-amber-500/10">
                              <Coins className="h-3 w-3 text-amber-400/60" />
                              <span className="text-amber-400/80 text-xs font-semibold tabular-nums">{u.credits}</span>
                            </div>
                            {u.role !== "ADMIN" && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.username)}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 border border-transparent hover:border-red-500/15"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ COOKIES ═══ */}
          {tab === "cookies" && (
            <motion.div
              key="cookies"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Upload Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-violet-500/10 flex items-center justify-center">
                      <Upload className="h-4 w-4 text-purple-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">Subir Cookies</h2>
                      <p className="text-[10px] text-white/25 font-medium">Archivo .txt o .zip · Duplicados detectados automáticamente</p>
                    </div>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Drag & Drop Upload Area */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files?.[0] && fileInputRef.current) {
                        const dt = new DataTransfer();
                        dt.items.add(e.dataTransfer.files[0]);
                        fileInputRef.current.files = dt.files;
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
                      isDragOver
                        ? "border-red-500/40 bg-red-500/[0.04] scale-[1.01]"
                        : "border-white/[0.08] bg-white/[0.01] hover:border-white/[0.15] hover:bg-white/[0.02]"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.zip"
                      className="hidden"
                      onChange={() => {}}
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                        isDragOver
                          ? "bg-red-500/15"
                          : "bg-white/[0.04]"
                      }`}>
                        <Upload className={`h-6 w-6 transition-colors duration-300 ${
                          isDragOver ? "text-red-400" : "text-white/20"
                        }`} />
                      </div>
                      <div>
                        <p className="text-white/40 text-sm font-medium">
                          {isDragOver ? "Suelta el archivo aquí" : "Arrastra tu archivo aquí"}
                        </p>
                        <p className="text-white/15 text-xs mt-1">o haz clic para seleccionar · .txt / .zip</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleUploadCookies}
                      disabled={uploadingCookies || refreshing}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-[0.98]"
                    >
                      {uploadingCookies ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Subir
                    </button>
                    <button
                      onClick={handleRefreshCookies}
                      disabled={refreshing || uploadingCookies}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/10 active:scale-[0.98]"
                    >
                      {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                      Refrescar Cookies
                    </button>
                    <button
                      onClick={handleCleanDead}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.05] text-red-400 text-sm font-semibold transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpiar Muertas
                    </button>
                  </div>
                </div>
              </div>

              {/* Cookies List Card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                      <Cookie className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-white text-sm font-semibold">
                        Cookies
                        <span className="text-white/20 ml-1.5 font-normal">({cookies.length})</span>
                      </h2>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold px-2 py-0 h-5 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
                        {stats?.activeCookies} activas
                      </Badge>
                      <Badge className="bg-red-500/10 text-red-400 border border-red-500/15 text-[10px] font-bold px-2 py-0 h-5 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {stats?.deadCookies} muertas
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="p-2 premium-scroll max-h-[520px] overflow-y-auto">
                  {cookies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <Inbox className="h-6 w-6 text-white/15" />
                      </div>
                      <div className="text-center">
                        <p className="text-white/25 text-sm font-medium">Sin cookies subidas</p>
                        <p className="text-white/10 text-xs mt-1">Sube tu primer archivo arriba</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {cookies.map((c) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={`p-3.5 rounded-xl transition-all duration-200 hover:bg-opacity-80 ${
                            c.status === "ACTIVE"
                              ? "bg-emerald-500/[0.03] border border-emerald-500/10 hover:bg-emerald-500/[0.05]"
                              : "bg-red-500/[0.03] border border-red-500/10 hover:bg-red-500/[0.05]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[9px] font-bold px-2 py-0.5 h-5 border-0 flex items-center gap-1.5 ${
                                c.status === "ACTIVE"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}>
                                {c.status === "ACTIVE" ? (
                                  <>
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                                    </span>
                                    ACTIVA
                                  </>
                                ) : (
                                  <>
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                    MUERTA
                                  </>
                                )}
                              </Badge>
                              <span className="text-white/15 text-[10px] font-medium">
                                <Eye className="h-3 w-3 inline mr-0.5 -mt-px" />
                                {c.usedCount} usos
                              </span>
                            </div>
                            <span className="text-white/15 text-[10px] font-medium">
                              {new Date(c.createdAt).toLocaleDateString("es")}
                            </span>
                          </div>
                          <p className="text-white/15 text-[10px] font-mono truncate leading-relaxed">
                            {c.rawCookie.substring(0, 100)}...
                          </p>
                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {c.lastError && (
                              <p className="text-red-400/50 text-[10px] flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {c.lastError}
                              </p>
                            )}
                            {c.lastUsed && (
                              <p className="text-white/12 text-[10px]">
                                Último uso: {new Date(c.lastUsed).toLocaleString("es")}
                              </p>
                            )}
                            {(c.country || c.plan) && (
                              <div className="flex items-center gap-1.5">
                                {c.country && (
                                  <Badge className="bg-white/[0.04] text-white/30 border border-white/[0.06] text-[9px] px-1.5 py-0 h-4">
                                    {c.country}
                                  </Badge>
                                )}
                                {c.plan && (
                                  <Badge className="bg-white/[0.04] text-white/30 border border-white/[0.06] text-[9px] px-1.5 py-0 h-4">
                                    {c.plan}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// ─── Extra Icon (not in lucide, use existing) ───────────────────────────────
function UserPlus({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
