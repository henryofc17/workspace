"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Copy, Check, ArrowLeft } from "lucide-react";

function KeyResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const c = searchParams.get("code");
    if (!c) {
      router.replace("/");
      return;
    }
    setCode(c);
    setLoading(false);
  }, [searchParams, router]);

  const handleCopy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading || !code) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
            <Check className="h-8 w-8 text-amber-400" />
          </div>
          <h1 className="text-white text-xl font-bold">Tu Key de Créditos</h1>
          <p className="text-white/40 text-sm">Copia este código y pégalo en el panel</p>
        </div>

        <div className="bg-[#0a0a10] border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="bg-[#050508] rounded-xl p-4 border border-white/[0.06] text-center">
            <p className="text-amber-300 font-mono text-2xl font-bold tracking-widest select-all">
              {code}
            </p>
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-white font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(251,191,36,0.15)] hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]"
          >
            {copied ? (
              <><Check className="h-5 w-5" /> Copiado</>
            ) : (
              <><Copy className="h-5 w-5" /> Copiar Key</>
            )}
          </button>

          <p className="text-white/20 text-[11px] text-center">
            Esta key expira en 15 minutos. Regresa al panel y pégala en &quot;Validar Key&quot;.
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.08] transition-all text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al Panel
        </button>
      </div>
    </div>
  );
}

export default function KeyResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-amber-400 border-t-transparent rounded-full" />
      </div>
    }>
      <KeyResultContent />
    </Suspense>
  );
}