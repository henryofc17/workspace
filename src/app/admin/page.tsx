"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Shield,
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#141414]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#E50914] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">
                Panel Admin
                <span className="text-[#E50914] ml-1">HacheJota</span>
              </h1>
              <p className="text-[10px] text-gray-500">Netflix Cookie Checker Pro</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats?.allCookiesDead && (
              <Badge className="bg-red-600 text-white text-xs animate-pulse mr-2">
                <AlertTriangle className="h-3 w-3 mr-1" /> Sin cookies activas
              </Badge>
            )}
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex gap-2 bg-[#1F1F1F] p-1 rounded-lg border border-white/10">
          {([
            { key: "dashboard", label: "Dashboard", icon: TrendingUp },
            { key: "users", label: "Usuarios", icon: Users },
            { key: "cookies", label: "Cookies", icon: Cookie },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                tab === key
                  ? "bg-[#E50914] text-white"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Usuarios" value={stats?.totalUsers || 0} color="blue" />
              <StatCard icon={Cookie} label="Cookies Activas" value={stats?.activeCookies || 0} color="green" />
              <StatCard icon={X} label="Cookies Muertas" value={stats?.deadCookies || 0} color="red" />
              <StatCard icon={Coins} label="Transacciones" value={stats?.totalTransactions || 0} color="yellow" />
            </div>

            {stats?.allCookiesDead && stats.totalCookies > 0 && (
              <Card className="border-red-900/50 bg-red-950/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-400 shrink-0" />
                  <div>
                    <h3 className="text-red-400 font-semibold text-sm">Todas las cookies están muertas</h3>
                    <p className="text-red-300/60 text-xs mt-1">Sube nuevas cookies para que los usuarios puedan generar tokens.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Transactions */}
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#E50914]" />
                  Transacciones Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {transactions.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">Sin transacciones</p>
                  ) : (
                    transactions.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-[#0a0a0a] text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 font-medium">{t.user.username}</span>
                          <Badge variant="outline" className={`text-[10px] ${t.credits >= 0 ? "border-green-800 text-green-400" : "border-red-800 text-red-400"}`}>
                            {t.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={t.credits >= 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                            {t.credits >= 0 ? "+" : ""}{t.credits}
                          </span>
                          <span className="text-gray-600 text-[10px]">
                            {new Date(t.createdAt).toLocaleDateString("es")}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── USERS ── */}
        {tab === "users" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create User */}
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Plus className="h-4 w-4 text-green-400" />
                  Crear Usuario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Usuario"
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600"
                />
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña"
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600"
                />
                <Input
                  type="number"
                  value={newCredits}
                  onChange={(e) => setNewCredits(e.target.value)}
                  placeholder="Créditos iniciales"
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600"
                />
                <Button
                  onClick={handleCreateUser}
                  disabled={creatingUser || !newUsername.trim() || !newPassword.trim()}
                  className="w-full bg-green-700 hover:bg-green-600 text-white"
                >
                  {creatingUser ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Crear Usuario
                </Button>
              </CardContent>
            </Card>

            {/* Manage Credits */}
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-yellow-400" />
                  Gestión de Créditos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  value={creditUserId}
                  onChange={(e) => setCreditUserId(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-white/10 text-white rounded-md px-3 py-2 text-sm focus:border-[#E50914]/50 outline-none"
                >
                  <option value="">Seleccionar usuario...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username} ({u.credits} créditos)
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Cantidad (+ para dar, - para quitar)"
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600"
                />
                <Input
                  value={creditDesc}
                  onChange={(e) => setCreditDesc(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600"
                />
                <Button
                  onClick={handleUpdateCredits}
                  disabled={updatingCredits || !creditUserId || !creditAmount}
                  className="w-full bg-yellow-700 hover:bg-yellow-600 text-white"
                >
                  {updatingCredits ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Coins className="h-4 w-4 mr-2" />}
                  Actualizar Créditos
                </Button>
              </CardContent>
            </Card>

            {/* Users List */}
            <Card className="border-white/10 bg-[#1F1F1F] lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  Todos los Usuarios ({users.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                  {users.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">Sin usuarios</p>
                  ) : (
                    users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-[#0a0a0a]">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-blue-950/50 flex items-center justify-center">
                            <span className="text-blue-400 text-xs font-bold">{u.username[0].toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{u.username}</p>
                            <p className="text-gray-600 text-[10px]">{u._count.transactions} transacciones</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="border-yellow-800 text-yellow-400 text-xs">
                            {u.credits} créditos
                          </Badge>
                          {u.role !== "ADMIN" && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="h-7 w-7 rounded flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── COOKIES ── */}
        {tab === "cookies" && (
          <div className="space-y-6">
            {/* Upload */}
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4 text-purple-400" />
                  Subir Cookies
                </CardTitle>
                <CardDescription className="text-gray-500 text-xs">
                  Sube un archivo .txt o .zip con cookies de Netflix. Se detectan duplicados automáticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.zip"
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#E50914] file:text-white hover:file:bg-[#b2070f] file:cursor-pointer file:transition-colors"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleUploadCookies}
                    disabled={uploadingCookies}
                    className="bg-[#E50914] hover:bg-[#b2070f] text-white"
                  >
                    {uploadingCookies ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Subir
                  </Button>
                  <Button onClick={handleCleanDead} variant="outline" className="border-red-800/30 text-red-400 hover:bg-red-950/30">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpiar Muertas
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Cookies List */}
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-orange-400" />
                  Cookies ({cookies.length})
                  <Badge variant="outline" className="border-green-800 text-green-400 text-[10px]">
                    {stats?.activeCookies} activas
                  </Badge>
                  <Badge variant="outline" className="border-red-800 text-red-400 text-[10px]">
                    {stats?.deadCookies} muertas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {cookies.length === 0 ? (
                    <p className="text-gray-600 text-sm text-center py-8">Sin cookies subidas</p>
                  ) : (
                    cookies.map((c) => (
                      <div key={c.id} className={`p-3 rounded-lg ${c.status === "ACTIVE" ? "bg-green-950/10 border border-green-900/20" : "bg-red-950/10 border border-red-900/20"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] ${c.status === "ACTIVE" ? "bg-green-900/50 text-green-400" : "bg-red-900/50 text-red-400"}`}>
                              {c.status === "ACTIVE" ? "ACTIVA" : "MUERTA"}
                            </Badge>
                            <span className="text-gray-500 text-[10px]">Usada {c.usedCount} veces</span>
                          </div>
                          <span className="text-gray-600 text-[10px]">
                            {new Date(c.createdAt).toLocaleDateString("es")}
                          </span>
                        </div>
                        <p className="text-gray-600 text-[10px] font-mono truncate">
                          {c.rawCookie.substring(0, 100)}...
                        </p>
                        {c.lastError && (
                          <p className="text-red-400/60 text-[10px] mt-1">Error: {c.lastError}</p>
                        )}
                        {c.lastUsed && (
                          <p className="text-gray-600 text-[10px] mt-1">Último uso: {new Date(c.lastUsed).toLocaleString("es")}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Global Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      `}</style>
    </div>
  );
}

// ─── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400 bg-blue-950/30 border-blue-900/20",
    green: "text-green-400 bg-green-950/30 border-green-900/20",
    red: "text-red-400 bg-red-950/30 border-red-900/20",
    yellow: "text-yellow-400 bg-yellow-950/30 border-yellow-900/20",
  };
  const iconColors: Record<string, string> = {
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${iconColors[color] || ""}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}
