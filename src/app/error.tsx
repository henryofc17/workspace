"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-red-950/50 border border-red-900/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Error inesperado</h2>
          <p className="text-gray-500 text-sm">
            Ocurri&oacute; un error al cargar la p&aacute;gina. Intenta recargar.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => reset()}
            className="flex-1 bg-[#E50914] hover:bg-[#b2070f] text-white font-semibold h-11"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          <Button
            onClick={() => {
              fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            variant="outline"
            className="flex-1 border-white/10 text-gray-400 hover:text-white hover:bg-white/5 h-11"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </div>
    </div>
  );
}
