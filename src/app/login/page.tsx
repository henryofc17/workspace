"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      toast.error("Completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar sesión");
        return;
      }

      toast.success(`Bienvenido, ${data.user.username}`);

      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else {
        router.push("/");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }, [username, password, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center shadow-lg shadow-red-900/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Netflix Checker
              <span className="text-[#E50914] ml-1">Pro</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">Inicia sesión para continuar</p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-white/10 bg-[#1F1F1F]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <LogIn className="h-4 w-4 text-[#E50914]" />
              Acceso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Usuario</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus:border-[#E50914]/50"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-medium">Contraseña</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus:border-[#E50914]/50"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full bg-[#E50914] hover:bg-[#b2070f] text-white font-semibold h-11 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Iniciar Sesión"
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-gray-700 text-[10px]">
          Netflix Cookie Checker Pro — Desarrollado por HacheJota
        </p>
      </div>
    </div>
  );
}
