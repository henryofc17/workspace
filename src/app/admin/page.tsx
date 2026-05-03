"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  X,
  Coins,
  TrendingUp,
  UserCircle,
  Inbox,
  Crown,
  Activity,
  Eye,
  Copy,
  Search,
  ChevronRight,
  ArrowLeft,
  UserPlus,
  Calendar,
  Link2,
  Clock,
  Zap,
  Hash,
  Gift,
  History,
  UserCog,
  Filter,
  KeyRound,
  EyeOff,
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
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  _count: { transactions: number; referrals: number };
  referrer: { username: string; id: string } | null;
}

interface UserDetail extends UserRecord {
  ipAddress: string | null;
  passwordPlain: string | null;
  updatedAt: string;
  referrals: {
    id: string;
    username: string;
    credits: number;
    role: string;
    createdAt: string;
    _count: { referrals: number; transactions: number };
  }[];
  transactions: {
    id: string;
    type: string;
    credits: number;
    description: string | null;
    createdAt: string;
  }[];
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

  const gradientMap: Record<string, { bg: string; icon: string; ring: string }> = {
    blue: { bg: "from-blue-600/20 to-cyan-600/10", icon: "from-blue-500 to-cyan-400", ring: "ring-blue-500/20" },
    green: { bg: "from-emerald-600/20 to-green-600/10", icon: "from-emerald-500 to-green-400", ring: "ring-emerald-500/20" },
    red: { bg: "from-red-600/20 to-rose-600/10", icon: "from-red-500 to-rose-400", ring: "ring-red-500/20" },
    yellow: { bg: "from-amber-600/20 to-yellow-600/10", icon: "from-amber-500 to-yellow-400", ring: "ring-amber-500/20" },
    purple: { bg: "from-purple-600/20 to-violet-600/10", icon: "from-purple-500 to-violet-400", ring: "ring-purple-500/20" },
  };

  const scheme = gradientMap[color] || gradientMap.blue;

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

// ─── Panel Card Wrapper ─────────────────────────────────────────────────────

function PanelCard({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  children,
  className = "",
  headerExtra,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  headerExtra?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${iconColor} flex items-center justify-center`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-white text-sm font-semibold">{title}</h2>
              {subtitle && <p className="text-[10px] text-white/25 font-medium">{subtitle}</p>}
            </div>
          </div>
          {headerExtra}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────

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

// ─── UserPlus Icon SVG ─────────────────────────────────────────────────────

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
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

  // Duplicates
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);

  // Active tab
  const [tab, setTab] = useState<"dashboard" | "users" | "cookies">("dashboard");

  // User search
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "admin" | "user">("all");

  // User detail modal
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [loadingUserDetail, setLoadingUserDetail] = useState(false);

  // Quick credit in modal
  const [modalCreditAmount, setModalCreditAmount] = useState("");
  const [modalCreditDesc, setModalCreditDesc] = useState("");
  const [updatingModalCredits, setUpdatingModalCredits] = useState(false);

  // Admin change user password
  const [adminNewPwd, setAdminNewPwd] = useState("");
  const [adminChangingPwd, setAdminChangingPwd] = useState(false);
  const [showAdminPwd, setShowAdminPwd] = useState(false);

  // User sort
  const [userSort, setUserSort] = useState<"newest" | "oldest" | "credits" | "referrals">("newest");

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

  // ── User Detail ──
  const handleOpenUserDetail = useCallback(async (userId: string) => {
    setLoadingUserDetail(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
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

  const handleCloseUserDetail = useCallback(() => {
    setSelectedUser(null);
    setModalCreditAmount("");
    setModalCreditDesc("");
  }, []);

  // ── Quick Credit from Modal ──
  const handleModalCreditUpdate = useCallback(async () => {
    if (!selectedUser || !modalCreditAmount) return;
    setUpdatingModalCredits(true);
    try {
      const res = await fetch("/api/admin/credits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: Number(modalCreditAmount),
          description: modalCreditDesc || undefined,
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
      // Refresh detail
      handleOpenUserDetail(selectedUser.id);
      loadData();
    } catch {
      toast.error("Error al actualizar créditos");
    }
    setUpdatingModalCredits(false);
  }, [selectedUser, modalCreditAmount, modalCreditDesc, handleOpenUserDetail, loadData]);

  // ── Admin Change User Password ──
  const handleAdminChangePwd = useCallback(async () => {
    if (!selectedUser || !adminNewPwd.trim()) return;
    if (adminNewPwd.length < 4 || adminNewPwd.length > 64) {
      toast.error("La contraseña debe tener entre 4 y 64 caracteres");
      return;
    }
    setAdminChangingPwd(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: adminNewPwd.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        return;
      }
      toast.success(data.message);
      setAdminNewPwd("");
      setShowAdminPwd(false);
      handleOpenUserDetail(selectedUser.id);
    } catch {
      toast.error("Error al cambiar contraseña");
    }
    setAdminChangingPwd(false);
  }, [selectedUser, adminNewPwd, handleOpenUserDetail]);

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
    if (!confirm(`¿Eliminar usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/users?id=${userId}`, { method: "DELETE" });
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

  // ── Update Credits (tab form) ──
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

  // ── Check Duplicates ──
  const handleCheckDuplicates = useCallback(async () => {
    setCheckingDuplicates(true);
    setDuplicateCount(null);
    try {
      const cookiesRes = await fetch("/api/admin/cookies").then((r) => r.json());
      if (!cookiesRes.success) { toast.error("Error al obtener cookies"); return; }

      const seenIds = new Map<string, number>();
      let dupes = 0;
      for (const cookie of cookiesRes.cookies) {
        const match = cookie.rawCookie.match(/NetflixId=([^;]+)/);
        if (!match) continue;
        const netflixId = match[1];
        if (seenIds.has(netflixId)) {
          dupes++;
        } else {
          seenIds.set(netflixId, 1);
        }
      }
      setDuplicateCount(dupes);
      if (dupes === 0) {
        toast.success("No hay cookies duplicadas");
      } else {
        toast.info(`Se encontraron ${dupes} cookies duplicadas`);
      }
    } catch {
      toast.error("Error al buscar duplicados");
    } finally {
      setCheckingDuplicates(false);
    }
  }, []);

  // ── Delete Duplicates ──
  const handleDeleteDuplicates = useCallback(async () => {
    if (!confirm(`¿Eliminar ${duplicateCount} cookies duplicadas? Se mantendrá la más antigua de cada grupo.`)) return;
    setDeletingDuplicates(true);
    try {
      const res = await fetch("/api/admin/cookies?type=duplicates", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `${data.deleted} duplicadas eliminadas`);
        setDuplicateCount(null);
        loadData();
      } else {
        toast.error(data.error || "Error al eliminar duplicadas");
      }
    } catch {
      toast.error("Error al eliminar duplicadas");
    } finally {
      setDeletingDuplicates(false);
    }
  }, [duplicateCount, loadData]);

  // ── Logout ──
  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }, [router]);

  // ── Copy to clipboard ──
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  }, []);

  // ── Filtered + sorted users ──
  const filteredUsers = users
    .filter((u) => {
      const matchSearch = u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.referralCode.toLowerCase().includes(userSearch.toLowerCase());
      const matchFilter = userFilter === "all" ||
        (userFilter === "admin" && u.role === "ADMIN") ||
        (userFilter === "user" && u.role === "USER");
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      switch (userSort) {
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "credits": return b.credits - a.credits;
        case "referrals": return b._count.referrals - a._count.referrals;
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

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
                <img
                  src="https://i.ibb.co/BKy3LKzL/AISelect-20260430-120048-Google.jpg"
                  alt="Logo"
                  className="h-7 w-auto rounded-md object-contain"
                />
                <div className="hidden sm:block h-6 w-px bg-white/10" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold text-white tracking-tight">Panel Admin</h1>
                    <Badge className="bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/20 text-[10px] font-semibold px-2 py-0.5 h-5">
                      <Shield className="h-3 w-3 mr-1" />
                      ADMIN
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
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-semibold px-2.5 py-0.5 h-6 cursor-default">
                      <span className="relative flex h-2 w-2 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                      </span>
                      Sin cookies
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
              <PanelCard
                icon={TrendingUp}
                iconColor="from-red-500/20 to-orange-500/10"
                title="Transacciones Recientes"
                subtitle={`${transactions.length} registros`}
              >
                <div className="p-2 premium-scroll max-h-[420px] overflow-y-auto">
                  {transactions.length === 0 ? (
                    <EmptyState icon={TrendingUp} text="Sin transacciones" subtext="Las transacciones aparecerán aquí" />
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
                              t.credits >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                            }`}>
                              <TrendingUp className={`h-3.5 w-3.5 ${t.credits >= 0 ? "text-emerald-400" : "text-red-400 rotate-180"}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-white/80 text-sm font-medium truncate">{t.user.username}</span>
                                <Badge className={`text-[9px] font-bold px-1.5 py-0 h-4 border-0 ${
                                  t.credits >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                }`}>
                                  {t.type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-sm font-bold tabular-nums ${t.credits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
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
              </PanelCard>
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
              <PanelCard
                icon={UserPlusIcon}
                iconColor="from-emerald-500/20 to-green-500/10"
                title="Crear Usuario"
                subtitle="Nuevo usuario del sistema"
              >
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
                    {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Crear Usuario
                  </button>
                </div>
              </PanelCard>

              {/* Manage Credits Card */}
              <PanelCard
                icon={CreditCard}
                iconColor="from-amber-500/20 to-yellow-500/10"
                title="Gestión de Créditos"
                subtitle="Añadir o quitar créditos"
              >
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
                    {updatingCredits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                    Actualizar Créditos
                  </button>
                </div>
              </PanelCard>

              {/* Users List Card */}
              <PanelCard
                icon={Users}
                iconColor="from-blue-500/20 to-cyan-500/10"
                title="Todos los Usuarios"
                subtitle={`${filteredUsers.length} de ${users.length}`}
                className="lg:col-span-2"
                headerExtra={
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold px-2 py-0 h-5">
                      {users.filter(u => u._count.referrals > 0).length} con referidos
                    </Badge>
                  </div>
                }
              >
                {/* Search + Filters */}
                <div className="px-5 py-3 border-b border-white/[0.04] space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Buscar por usuario o código de referido..."
                      className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                    />
                  </div>
                  {/* Filters + Sort row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5">
                      {([["all", "Todos"], ["admin", "Admin"], ["user", "User"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setUserFilter(key)}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                            userFilter === key
                              ? "bg-red-500/15 text-red-400 border border-red-500/20"
                              : "text-white/30 hover:text-white/50 border border-transparent"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg border border-white/[0.06] p-0.5">
                      {([["newest", "Recientes"], ["oldest", "Antiguos"], ["credits", "Créditos"], ["referrals", "Referidos"]] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setUserSort(key)}
                          className={`px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all duration-200 ${
                            userSort === key
                              ? "bg-white/[0.08] text-white/70 border border-white/[0.1]"
                              : "text-white/25 hover:text-white/40 border border-transparent"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-2 premium-scroll max-h-[500px] overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <EmptyState icon={UserCircle} text="Sin usuarios" subtext={userSearch ? "No hay coincidencias con tu búsqueda" : "Crea el primer usuario arriba"} />
                  ) : (
                    <div className="space-y-1.5">
                      {filteredUsers.map((u) => (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="group flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-all duration-200 cursor-pointer"
                          onClick={() => handleOpenUserDetail(u.id)}
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
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-white/15 text-[10px] font-mono">{u.referralCode}</span>
                                {u._count.referrals > 0 && (
                                  <span className="text-purple-400/50 text-[10px] font-medium">
                                    <Gift className="h-2.5 w-2.5 inline -mt-px mr-0.5" />
                                    {u._count.referrals} referidos
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/5 border border-amber-500/10">
                              <Coins className="h-3 w-3 text-amber-400/60" />
                              <span className="text-amber-400/80 text-xs font-semibold tabular-nums">{u.credits}</span>
                            </div>
                            {u.role !== "ADMIN" && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id, u.username); }}
                                className="h-8 w-8 rounded-lg flex items-center justify-center text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 border border-transparent hover:border-red-500/15"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <ChevronRight className="h-4 w-4 text-white/10 group-hover:text-white/30 transition-colors" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </PanelCard>
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
              <PanelCard
                icon={Upload}
                iconColor="from-purple-500/20 to-violet-500/10"
                title="Subir Cookies"
                subtitle="Archivo .txt o .zip · Duplicados detectados automáticamente"
              >
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
                        isDragOver ? "bg-red-500/15" : "bg-white/[0.04]"
                      }`}>
                        <Upload className={`h-6 w-6 transition-colors duration-300 ${isDragOver ? "text-red-400" : "text-white/20"}`} />
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
                      {uploadingCookies ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Subir
                    </button>
                    <button
                      onClick={handleRefreshCookies}
                      disabled={refreshing || uploadingCookies}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-500/10 active:scale-[0.98]"
                    >
                      {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Refrescar Cookies
                    </button>
                    <button
                      onClick={handleCleanDead}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.05] text-red-400 text-sm font-semibold transition-all duration-200 hover:bg-red-500/10 active:scale-[0.98]"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpiar Muertas
                    </button>
                    <button
                      onClick={handleCheckDuplicates}
                      disabled={checkingDuplicates || refreshing || uploadingCookies}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] text-amber-400 text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-500/10 active:scale-[0.98]"
                    >
                      {checkingDuplicates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                      Buscar Repetidas
                    </button>
                    {duplicateCount !== null && duplicateCount > 0 && (
                      <button
                        onClick={handleDeleteDuplicates}
                        disabled={deletingDuplicates}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-red-500/10 hover:shadow-red-500/20 active:scale-[0.98]"
                      >
                        {deletingDuplicates ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Eliminar Repetidas ({duplicateCount})
                      </button>
                    )}
                  </div>
                </div>
              </PanelCard>

              {/* Cookies List Card */}
              <PanelCard
                icon={Cookie}
                iconColor="from-orange-500/20 to-amber-500/10"
                title="Cookies"
                subtitle={`${cookies.length} total`}
                headerExtra={
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold px-2 py-0 h-5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
                      {stats?.activeCookies} activas
                    </Badge>
                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/15 text-[10px] font-bold px-2 py-0 h-5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                      {stats?.deadCookies} muertas
                    </Badge>
                  </div>
                }
              >
                <div className="p-2 premium-scroll max-h-[520px] overflow-y-auto">
                  {cookies.length === 0 ? (
                    <EmptyState icon={Inbox} text="Sin cookies subidas" subtext="Sube tu primer archivo arriba" />
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
                                c.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
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
              </PanelCard>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ═══ USER DETAIL MODAL ═══ */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCloseUserDetail} />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCloseUserDetail}
                    className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      selectedUser.role === "ADMIN"
                        ? "bg-gradient-to-br from-red-500/20 to-orange-500/10 text-red-400 border border-red-500/20"
                        : "bg-gradient-to-br from-blue-500/15 to-cyan-500/10 text-blue-400 border border-blue-500/10"
                    }`}>
                      {selectedUser.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-white font-bold text-base">{selectedUser.username}</h2>
                        {selectedUser.role === "ADMIN" ? (
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
                      <p className="text-white/25 text-[10px] font-medium mt-0.5">ID: {selectedUser.id.slice(0, 12)}...</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleCloseUserDetail}
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto premium-scroll">
                <div className="p-6 space-y-5">
                  {/* User Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Coins className="h-3 w-3 text-amber-400/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Créditos</span>
                      </div>
                      <p className="text-xl font-bold text-amber-400 tabular-nums">{selectedUser.credits}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <History className="h-3 w-3 text-blue-400/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Transacciones</span>
                      </div>
                      <p className="text-xl font-bold text-blue-400 tabular-nums">{selectedUser._count.transactions}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Gift className="h-3 w-3 text-purple-400/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Referidos</span>
                      </div>
                      <p className="text-xl font-bold text-purple-400 tabular-nums">{selectedUser._count.referrals}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-emerald-400/60" />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Registro</span>
                      </div>
                      <p className="text-sm font-bold text-emerald-400">{new Date(selectedUser.createdAt).toLocaleDateString("es")}</p>
                    </div>
                  </div>

                  {/* Referral Info */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-purple-400" />
                        <h3 className="text-white text-sm font-semibold">Sistema de Referidos</h3>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Referral Code */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash className="h-3.5 w-3.5 text-white/25" />
                          <span className="text-white/40 text-xs">Código de referido</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(selectedUser.referralCode, "Código")}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all group"
                        >
                          <span className="text-white/70 text-xs font-mono font-bold">{selectedUser.referralCode}</span>
                          <Copy className="h-3 w-3 text-white/20 group-hover:text-white/50 transition-colors" />
                        </button>
                      </div>
                      {/* Referrer */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <UserPlusIcon className="h-3.5 w-3.5 text-white/25" />
                          <span className="text-white/40 text-xs">Referido por</span>
                        </div>
                        {selectedUser.referrer ? (
                          <button
                            onClick={() => { handleCloseUserDetail(); setTimeout(() => handleOpenUserDetail(selectedUser.referrer!.id), 300); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all group"
                          >
                            <span className="text-white/70 text-xs font-semibold">{selectedUser.referrer.username}</span>
                            <ChevronRight className="h-3 w-3 text-white/20 group-hover:text-white/50 transition-colors" />
                          </button>
                        ) : (
                          <span className="text-white/15 text-xs italic">Ninguno</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Credit Adjustment */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <UserCog className="h-4 w-4 text-amber-400" />
                        <h3 className="text-white text-sm font-semibold">Ajuste Rápido de Créditos</h3>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Cantidad</label>
                          <input
                            type="number"
                            value={modalCreditAmount}
                            onChange={(e) => setModalCreditAmount(e.target.value)}
                            placeholder="+100 o -50"
                            className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                          />
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Razón</label>
                          <input
                            value={modalCreditDesc}
                            onChange={(e) => setModalCreditDesc(e.target.value)}
                            placeholder="Opcional..."
                            className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                          />
                        </div>
                        <button
                          onClick={handleModalCreditUpdate}
                          disabled={updatingModalCredits || !modalCreditAmount}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/10 active:scale-[0.98] flex items-center gap-2 shrink-0"
                        >
                          {updatingModalCredits ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-sky-400" />
                        <h3 className="text-white text-sm font-semibold">Contraseña del Usuario</h3>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Current Password Display */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs">Contraseña actual</span>
                        </div>
                        {selectedUser.passwordPlain ? (
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-mono ${showAdminPwd ? "text-emerald-400" : "text-white/30"}`}>
                              {showAdminPwd ? selectedUser.passwordPlain : "••••••••"}
                            </span>
                            <button
                              onClick={() => { navigator.clipboard.writeText(selectedUser.passwordPlain!); toast.success("Contraseña copiada"); }}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setShowAdminPwd(!showAdminPwd)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-white/20 hover:text-white/60 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all"
                            >
                              {showAdminPwd ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-white/15 text-xs italic">No disponible (registrado antes de la actualización)</span>
                        )}
                      </div>
                      {/* Change Password Form */}
                      <div className="relative pt-3 border-t border-white/[0.04]">
                        <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-2">Cambiar contraseña</p>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <input
                              type="text"
                              value={adminNewPwd}
                              onChange={(e) => setAdminNewPwd(e.target.value)}
                              placeholder="Nueva contraseña..."
                              className="premium-input w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-red-500/30 transition-all duration-300"
                            />
                          </div>
                          <button
                            onClick={handleAdminChangePwd}
                            disabled={adminChangingPwd || !adminNewPwd.trim()}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-sky-500/10 active:scale-[0.98] flex items-center gap-2 shrink-0"
                          >
                            {adminChangingPwd ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                            Cambiar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Referrals List */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-400" />
                        <h3 className="text-white text-sm font-semibold">
                          Referidos
                          <span className="text-white/20 ml-1.5 font-normal">({selectedUser.referrals.length})</span>
                        </h3>
                      </div>
                    </div>
                    <div className="p-2 premium-scroll max-h-[280px] overflow-y-auto">
                      {selectedUser.referrals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <Gift className="h-8 w-8 text-white/10" />
                          <p className="text-white/20 text-xs">Este usuario no tiene referidos aún</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {selectedUser.referrals.map((ref) => (
                            <div
                              key={ref.id}
                              className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer group"
                              onClick={() => { handleCloseUserDetail(); setTimeout(() => handleOpenUserDetail(ref.id), 300); }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10 flex items-center justify-center text-xs font-bold shrink-0">
                                  {ref.username[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white/80 text-sm font-medium truncate">{ref.username}</span>
                                    <span className="text-white/15 text-[10px]">{ref._count.referrals} referidos</span>
                                  </div>
                                  <p className="text-white/15 text-[10px] mt-0.5">
                                    Registrado: {new Date(ref.createdAt).toLocaleDateString("es")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/5 border border-amber-500/10">
                                  <Coins className="h-2.5 w-2.5 text-amber-400/50" />
                                  <span className="text-amber-400/70 text-[11px] font-semibold tabular-nums">{ref.credits}</span>
                                </div>
                                <ChevronRight className="h-3.5 w-3.5 text-white/10 group-hover:text-white/30 transition-colors" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Transaction History */}
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-emerald-400" />
                        <h3 className="text-white text-sm font-semibold">
                          Historial de Transacciones
                          <span className="text-white/20 ml-1.5 font-normal">({selectedUser.transactions.length})</span>
                        </h3>
                      </div>
                    </div>
                    <div className="p-2 premium-scroll max-h-[300px] overflow-y-auto">
                      {selectedUser.transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-2">
                          <History className="h-8 w-8 text-white/10" />
                          <p className="text-white/20 text-xs">Sin transacciones</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {selectedUser.transactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                  t.credits >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"
                                }`}>
                                  <TrendingUp className={`h-3 w-3 ${t.credits >= 0 ? "text-emerald-400" : "text-red-400 rotate-180"}`} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Badge className={`text-[9px] font-bold px-1.5 py-0 h-4 border-0 ${
                                      t.credits >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                                    }`}>
                                      {t.type}
                                    </Badge>
                                    {t.description && (
                                      <span className="text-white/20 text-[10px] truncate hidden sm:inline">{t.description}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-xs font-bold tabular-nums ${t.credits >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {t.credits >= 0 ? "+" : ""}{t.credits}
                                </span>
                                <span className="text-white/10 text-[9px] font-medium">
                                  {new Date(t.createdAt).toLocaleDateString("es")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  {selectedUser.role !== "ADMIN" && (
                    <div className="rounded-xl border border-red-500/15 bg-red-500/[0.03] overflow-hidden">
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-red-400/80 text-sm font-semibold">Zona de Peligro</h3>
                          <p className="text-red-400/30 text-[10px] mt-0.5">Eliminar este usuario y todos sus datos permanentemente</p>
                        </div>
                        <button
                          onClick={() => { handleCloseUserDetail(); handleDeleteUser(selectedUser.id, selectedUser.username); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all active:scale-[0.98]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading overlay for user detail */}
      {loadingUserDetail && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-red-400 animate-spin" />
            <p className="text-white/40 text-sm font-medium">Cargando detalle...</p>
          </div>
        </div>
      )}
    </div>
  );
}
