"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Shield,
  Loader2,
  LogIn,
  MessageCircle,
  Send,
} from "lucide-react";

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
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
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-[#E50914] flex items-center justify-center shadow-xl shadow-red-900/30">
            <Shield className="h-8 w-8 text-white" />
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Netflix Checker
              <span className="text-[#E50914] ml-1">Pro</span>
            </h1>

            <p className="text-sm text-gray-400">
              Inicia sesión para continuar
            </p>
          </div>
        </div>

        {/* Card */}
        <Card className="border-white/10 bg-[#171717] backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <LogIn className="h-4 w-4 text-[#E50914]" />
              Acceso seguro
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Usuario */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">
                Usuario
              </label>

              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario"
                className="h-11 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus:border-[#E50914]/50"
                onKeyDown={(e) =>
                  e.key === "Enter" && handleLogin()
                }
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">
                Contraseña
              </label>

              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="h-11 bg-[#0a0a0a] border-white/10 text-white placeholder:text-gray-600 focus:border-[#E50914]/50"
                onKeyDown={(e) =>
                  e.key === "Enter" && handleLogin()
                }
              />
            </div>

            {/* Login button */}
            <Button
              onClick={handleLogin}
              disabled={
                loading ||
                !username.trim() ||
                !password.trim()
              }
              className="w-full h-11 bg-[#E50914] hover:bg-[#b2070f] text-white font-semibold rounded-xl transition-all"
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

            {/* Divider */}
            <div className="pt-2">
              <p className="text-center text-xs text-gray-500">
                ¿Necesitas ayuda? Contáctame
              </p>
            </div>

            {/* Contact buttons */}
            <div className="space-y-3">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-green-600 hover:bg-green-500 transition-all text-white font-medium shadow-lg"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>

              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-sky-600 hover:bg-sky-500 transition-all text-white font-medium shadow-lg"
              >
                <Send className="h-4 w-4" />
                Telegram
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-700 px-2">
          Netflix Cookie Checker Pro — Desarrollado por HacheJota
        </p>
      </div>
    </div>
  );
}
