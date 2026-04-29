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

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────

interface Transaction {
  id: string;
  type: string;
  credits: number;
  description: string | null;
  createdAt: string;
}

export default function Home() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [username, setUsername] =
    useState("");

  const [credits, setCredits] =
    useState(0);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  // ─────────────────────────────────────────
  // AUTH CHECK FIXED
  // ─────────────────────────────────────────

  const loadBalance =
    useCallback(async () => {
      try {
        const res =
          await fetch(
            "/api/user/balance",
            {
              credentials:
                "include",
              cache:
                "no-store",
            }
          );

        const data =
          await res.json();

        if (
          data.success
        ) {
          setCredits(
            data.credits
          );

          setTransactions(
            data.transactions ||
              []
          );
        }
      } catch {}
    }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const res =
          await fetch(
            "/api/auth/me",
            {
              credentials:
                "include",
              cache:
                "no-store",
            }
          );

        const data =
          await res.json();

        if (!mounted)
          return;

        if (
          !res.ok ||
          !data.success
        ) {
          window.location.href =
            "/login";
          return;
        }

        if (
          data.user
            .role ===
          "ADMIN"
        ) {
          window.location.href =
            "/admin";
          return;
        }

        setUsername(
          data.user
            .username
        );

        setCredits(
          data.user
            .credits
        );

        await loadBalance();

        setLoading(
          false
        );
      } catch {
        if (
          mounted
        ) {
          window.location.href =
            "/login";
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [loadBalance]);

  // ─────────────────────────────────────────
  // LOGOUT
  // ─────────────────────────────────────────

  const handleLogout =
    useCallback(
      async () => {
        await fetch(
          "/api/auth/logout",
          {
            method:
              "POST",
            credentials:
              "include",
          }
        );

        window.location.href =
          "/login";
      },
      []
    );

  // ─────────────────────────────────────────
  // LOADING SCREEN
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
      </div>
    );
  }

  // ─────────────────────────────────────────
  // MAIN UI
  // ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/10 bg-[#141414]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-[#E50914]" />
            <div>
              <h1 className="font-bold text-lg">
                Netflix Checker Pro
              </h1>
              <p className="text-xs text-gray-500">
                Bienvenido{" "}
                {username}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/10 px-3 py-1 rounded-full text-yellow-400 text-sm">
              {credits} créditos
            </div>

            <Button
              onClick={
                handleLogout
              }
              variant="ghost"
              size="sm"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Card className="bg-[#171717] border-white/10">
          <CardHeader>
            <CardTitle>
              Panel cargado correctamente
            </CardTitle>

            <CardDescription>
              Si ves esto,
              ya entró bien.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <p className="text-gray-400 text-sm">
              Tu sesión ya funciona.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
