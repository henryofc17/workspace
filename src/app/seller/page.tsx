"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Users,
  LogOut,
  Plus,
  Trash2,
  Loader2,
  Coins,
  Activity,
  Eye,
  EyeOff,
  Search,
  UserCog,
  X,
  CreditCard,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SellerStats {
  totalUsers: number;
  myCredits: number;
  totalUsersCredits: number;
  activeUsersToday: number;
}

interface SellerTransaction {
  id: string;
  type: string;
  credits: number;
  description: string | null;
  createdAt: string;
  user: { username: string };
}

interface SellerUser {
  id: string;
  username: string;
  credits: number;
  region: string | null;
  createdAt: string;
  _count: { transactions: number };
}

interface UserDetail {
  id: string;
  username: string;
  role: string;
  credits: number;
  region: string | null;
  createdAt: string;
  updatedAt: string;
  transactions: {
    id: string;
    type: string;
    credits: number;
    description: string | null;
    createdAt: string;
  }[];
  _count: { transactions: number };
}

// ─── Animated Counter ────────────────────────────────────────────────────────

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

// ─── Stat Card ───────────────────────────────────────────────────────────────

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
  const gradientMap: Record<string, { bg: string; icon: string; ring: string }> = {
    violet: { bg: "from-violet-600/20 to-purple-600/10", icon: "from-violet-500 to-purple-400", ring: "ring-violet-500/20" },
    blue: { bg: "from-blue-600/20 to-cyan-600/10", icon: "from-blue-500 to-cyan-400", ring: "ring-blue-500/20" },
    green: { bg: "from-emerald-600/20 to-green-600/10", icon: "from-emerald-500 to-green-400", ring: "ring-emerald-500/20" },
    yellow: { bg: "from-amber-600/20 to-yellow-600/10", icon: "from-amber-500 to-yellow-400", ring: "ring-amber-500/20" },
  };
  const scheme = gradientMap[color] || gradientMap.violet;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300"
    >
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

// ─── Panel Card ──────────────────────────────────────────────────────────────

function PanelCard({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${iconColor} flex items-center justify-center`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-white text-sm font-semibold">{title}</h2>
            {subtitle && <p className="text-[10px] text-white/25 font-medium">{subtitle}</p>}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, text, subtext }: { icon: React.ElementType; text: string; subtext: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
        <Icon className="h-6 w-6 text-white/15" />
      </div>
      <div className="text-center">
        <p className="text-white/25 text-sm font-medium">{text}</p>
        <p className="text-white/10 text-xs mt-1">{subtext}</p>
      </div>
    </div>
  );
}

// ─── Seller Page ─────────────────────────────────────────────────────────────

export default function SellerPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<SellerTransaction[]>([]);
  const [users, setUsers] = useState<SellerUser[]>([]);

  // Create user form
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCredits, setNewCredits] = useState("0");
  const [creatingUser, setCreatingUser] = useState(false);

  // Search
  const [userSearch, setUserSearch] = useState("");

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);
  const [modalCreditAmount, setModalCreditAmount] = useState("");
  const [modalCreditDesc, setModalCreditDesc] = useState("");
  const [updatingModalCredits, setUpdatingModalCredits] = useState(false);
  const [modalNewPwd, setModalNewPwd] = useState("");
  const [changingModalPwd, setChangingModalPwd] = useState(false);
  const [showModalPwd, setShowModalPwd] = useState(false);

  // Tab
  const [tab, setTab] = useState<"dashboard" | "users">("dashboard");

  // ── Auth Check ──
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success || data.user.role !== "SELLER") {
          router.push("/login");
        } else {
          loadData();
        }
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch("/api/seller/stats").then((r) => r.json()),
        fetch("/api/seller/users").then((r) => r.json()),
      ]);
      if (statsRes.success) {
        setStats(statsRes.stats);
        setRecentTransactions(statsRes.recentTransactions || []);
      }
      if (usersRes.success) setUsers(usersRes.users);
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
      const res = await fetch("/api/seller/users", {
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
    if (!confirm(`¿Eliminar usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/seller/users?id=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Usuario "${username}" eliminado`);
        if (selectedUser?.id === userId) setSelectedUser(null);
        loadData();
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al eliminar");
    }
  }, [loadData, selectedUser]);

  // ── Open User Detail ──
  const handleOpenUserDetail = useCallback(async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const res = await fetch(`/api/seller/users/${userId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedUser(data.user);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Error al cargar detalle del usuario");
    }
    setLoadingUserDetail(false);
  }, []);

  // ── Update Credits in Modal ──
  const handleModalCreditUpdate = useCallback(async () => {
    if (!selectedUser || !modalCreditAmount) return;
    setUpdatingModalCredits(true);
    try {
      const res = await fetch(`/api/seller/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditAmount: Number(modalCreditAmount),
          creditDescription: modalCreditDesc || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(`Créditos: ${selectedUser.username} → ${data.user.credits}`);
      setModalCreditAmount("");
      setModalCreditDesc("");
      handleOpenUserDetail(selectedUser.id);
      loadData();
    } catch {
      toast.error("Error al actualizar créditos");
    }
    setUpdatingModalCredits(false);
  }, [selectedUser, modalCreditAmount, modalCreditDesc, handleOpenUserDetail, loadData]);

  // ── Change Password in Modal ──
  const handleModalChangePwd = useCallback(async () => {
    if (!selectedUser || !modalNewPwd.trim()) return;
    if (modalNewPwd.length < 4 || modalNewPwd.length > 64) {
      toast.error("La contraseña debe tener entre 4 y 64 caracteres");
      return;
    }
    setChangingModalPwd(true);
    try {
      const res = await fetch(`/api/seller/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: modalNewPwd.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success("Contraseña actualizada");
      setModalNewPwd("");
      setShowModalPwd(false);
    } catch {
      toast.error("Error al cambiar contraseña");
    }
    setChangingModalPwd(false);
  }, [selectedUser, modalNewPwd]);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  // ── Filtered users ──
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userSearch.toLowerCase())
  );

  const tabs = [
    { key: "dashboard" as const, label: "Dashboard", icon: Activity },
    { key: "users" as const, label: "Usuarios", icon: Users },
  ];
  const tabIndex = tabs.findIndex((t) => t.key === tab);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050508] gap-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/20">
            <Store className="h-8 w-8 text-white" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 animate-ping opacity-20" />
        </motion.div>
        <p className="text-white/30 text-sm font-medium tracking-wide">Cargando panel...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] text-white antialiased">
      <style jsx global>{`
        .premium-scroll::-webkit-scrollbar { width: 5px; }
        .premium-scroll::-webkit-scrollbar-track { background: transparent; }
        .premium-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .premium-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        @keyframes gradient-shift { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .animated-gradient { background-size: 200% 200%; animation: gradient-shift 6s ease infinite; }
        .premium-input::placeholder { color: rgba(255,255,255,0.2); }
        .premium-input:focus { box-shadow: 0 0 0 2px rgba(139,92,246,0.15), 0 0 20px rgba(139,92,246,0.05); }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50">
        <div className="animated-gradient bg-gradient-to-r from-[#0c0c14] via-[#120a1a] to-[#0c0c14] border-b border-white/[0.06]">
          <div className="backdrop-blur-2xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg" alt="Logo" className="h-7 w-auto rounded-md object-contain" />
                <div className="hidden sm:block h-6 w-px bg-white/10" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold text-white tracking-tight">Panel Seller</h1>
                    <Badge className="bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-400 border border-violet-500/20 text-[10px] font-semibold px-2 py-0.5 h-5">
                      <Store className="h-3 w-3 mr-1" />
                      SELLER
                    </Badge>
                  </div>
                  <p className="text-[10px] text-white/25 font-medium tracking-wider uppercase">Netflix Cookie Checker Pro</p>
                </div>
              </div>
              <button onClick={handleLogout} className="h-9 w-9 rounded-xl border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all duration-200">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-12">
        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="relative flex bg-white/[0.03] backdrop-blur-xl p-1 rounded-2xl border border-white/[0.06]">
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/10 border border-violet-500/20 shadow-lg shadow-violet-500/5"
            animate={{ left: `${(tabIndex / tabs.length) * 100}%`, width: `${100 / tabs.length}%` }}
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
            <motion.div key="dashboard" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard icon={Coins} label="Mis Créditos" value={stats?.myCredits || 0} color="yellow" delay={0} />
                <StatCard icon={Users} label="Mis Usuarios" value={stats?.totalUsers || 0} color="violet" delay={0.05} />
                <StatCard icon={CreditCard} label="Créditos Usuarios" value={stats?.totalUsersCredits || 0} color="blue" delay={0.1} />
                <StatCard icon={Zap} label="Activos Hoy" value={stats?.activeUsersToday || 0} color="green" delay={0.15} />
              </div>

              {/* Recent Transactions */}
              <PanelCard icon={TrendingUp} iconColor="from-violet-500/20 to-purple-500/10" title="Transacciones Recientes" subtitle={`${recentTransactions.length} registros`}>
                <div className="p-2 premium-scroll max-h-[420px] overflow-y-auto">
                  {recentTransactions.length === 0 ? (
                    <EmptyState icon={TrendingUp} text="Sin transacciones" subtext="Las transacciones de tus usuarios aparecerán aquí" />
                  ) : (
                    <div className="space-y-1.5">
                      {recentTransactions.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-all text-xs">
                          <div className={`h-7 w-7 rounded-lg ${t.credits >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"} flex items-center justify-center shrink-0`}>
                            <Coins className={`h-3.5 w-3.5 ${t.credits >= 0 ? "text-emerald-400" : "text-red-400"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-white/60 font-medium">{t.user.username}</span>
                              <span className="text-white/20">{t.type}</span>
                            </div>
                            {t.description && <p className="text-white/15 truncate">{t.description}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`font-semibold tabular-nums ${t.credits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {t.credits >= 0 ? "+" : ""}{t.credits}
                            </span>
                            <p className="text-white/10">{new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PanelCard>
            </motion.div>
          )}

          {/* ═══ USERS ═══ */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }} className="space-y-6">
              {/* Create User */}
              <PanelCard icon={Users} iconColor="from-violet-500/20 to-purple-500/10" title="Crear Usuario" subtitle="Nuevo usuario bajo tu gestión">
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" placeholder="Usuario" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="premium-input h-10 px-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm outline-none focus:border-violet-500/40 transition-all" />
                    <input type="text" placeholder="Contraseña" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="premium-input h-10 px-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm outline-none focus:border-violet-500/40 transition-all" />
                    <input type="number" placeholder="Créditos" value={newCredits} onChange={(e) => setNewCredits(e.target.value)} className="premium-input h-10 px-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm outline-none focus:border-violet-500/40 transition-all" />
                  </div>
                  <button onClick={handleCreateUser} disabled={creatingUser} className="h-10 px-5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-medium disabled:opacity-40 transition-all flex items-center gap-2">
                    {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crear Usuario
                  </button>
                </div>
              </PanelCard>

              {/* Users List */}
              <PanelCard icon={Users} iconColor="from-violet-500/20 to-purple-500/10" title="Mis Usuarios" subtitle={`${users.length} registrados`}>
                <div className="p-2 premium-scroll max-h-[600px] overflow-y-auto">
                  {/* Search */}
                  <div className="px-2 py-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
                      <input type="text" placeholder="Buscar usuario..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full h-9 pl-9 pr-3 bg-white/[0.03] border border-white/[0.06] rounded-lg text-white text-xs outline-none focus:border-white/[0.15] transition-all" />
                    </div>
                  </div>
                  {filteredUsers.length === 0 ? (
                    <EmptyState icon={Users} text="Sin usuarios" subtext="Crea un usuario para comenzar" />
                  ) : (
                    <div className="space-y-1.5">
                      {filteredUsers.map((user) => (
                        <motion.div
                          key={user.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
                          onClick={() => handleOpenUserDetail(user.id)}
                        >
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white/80 text-sm font-medium truncate">{user.username}</p>
                            <p className="text-white/20 text-[11px]">
                              {user.credits} créditos · {user.region || "Sin región"} · {user._count.transactions} transacciones
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteUser(user.id, user.username); }} className="h-7 w-7 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/30 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </PanelCard>

              {/* User Detail Modal */}
              <AnimatePresence>
                {selectedUser && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4" onClick={() => { setSelectedUser(null); setModalCreditAmount(""); setModalCreditDesc(""); setModalNewPwd(""); }}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#0a0a12] border border-white/[0.08] rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto premium-scroll" onClick={(e) => e.stopPropagation()}>
                      <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <h3 className="text-white font-semibold">{selectedUser.username}</h3>
                            <p className="text-white/25 text-xs">Usuario · {selectedUser.credits} créditos</p>
                          </div>
                        </div>
                        <button onClick={() => { setSelectedUser(null); setModalCreditAmount(""); setModalCreditDesc(""); setModalNewPwd(""); }} className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-5 space-y-5">
                        {/* Quick Credit Update */}
                        <div className="space-y-2">
                          <h4 className="text-white/50 text-xs font-medium uppercase tracking-wider">Actualizar Créditos</h4>
                          <div className="grid grid-cols-2 gap-2">
                            <input type="number" placeholder="Cantidad (+/-)" value={modalCreditAmount} onChange={(e) => setModalCreditAmount(e.target.value)} className="premium-input h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-xs outline-none focus:border-violet-500/40 transition-all" />
                            <input type="text" placeholder="Descripción" value={modalCreditDesc} onChange={(e) => setModalCreditDesc(e.target.value)} className="premium-input h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-xs outline-none focus:border-violet-500/40 transition-all" />
                          </div>
                          <button onClick={handleModalCreditUpdate} disabled={updatingModalCredits} className="h-9 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-xs font-medium disabled:opacity-40 transition-all flex items-center gap-1.5">
                            {updatingModalCredits ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3" />}
                            Actualizar
                          </button>
                        </div>
                        {/* Change Password */}
                        <div className="space-y-2">
                          <h4 className="text-white/50 text-xs font-medium uppercase tracking-wider">Cambiar Contraseña</h4>
                          <div className="relative">
                            <input type={showModalPwd ? "text" : "password"} placeholder="Nueva contraseña" value={modalNewPwd} onChange={(e) => setModalNewPwd(e.target.value)} className="premium-input w-full h-9 px-3 pr-9 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-xs outline-none focus:border-violet-500/40 transition-all" />
                            <button onClick={() => setShowModalPwd(!showModalPwd)} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                              {showModalPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                          <button onClick={handleModalChangePwd} disabled={changingModalPwd} className="h-9 px-4 rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/70 text-xs font-medium hover:bg-white/[0.1] hover:border-white/[0.15] disabled:opacity-40 transition-all flex items-center gap-1.5">
                            {changingModalPwd ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCog className="h-3 w-3" />}
                            Cambiar Contraseña
                          </button>
                        </div>
                        {/* User Transactions */}
                        {selectedUser.transactions && selectedUser.transactions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-white/50 text-xs font-medium uppercase tracking-wider">Transacciones Recientes</h4>
                            <div className="space-y-1 max-h-40 overflow-y-auto premium-scroll">
                              {selectedUser.transactions.slice(0, 20).map((t) => (
                                <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.03] text-xs">
                                  <span className="text-white/40">{t.type}</span>
                                  <span className={t.credits >= 0 ? "text-emerald-400" : "text-red-400"}>{t.credits >= 0 ? "+" : ""}{t.credits}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Delete User */}
                        <div className="pt-2 border-t border-white/[0.06]">
                          <button onClick={() => handleDeleteUser(selectedUser.id, selectedUser.username)} className="h-9 px-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 hover:border-red-500/30 transition-all flex items-center gap-1.5">
                            <Trash2 className="h-3 w-3" />
                            Eliminar Usuario
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
