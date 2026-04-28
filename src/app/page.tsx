"use client";

import React, { useState, useCallback, useRef } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Upload,
  Download,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Globe,
  CreditCard,
  Monitor,
  User,
  Mail,
  Phone,
  Tv,
  Calendar,
  Zap,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface CheckResult {
  success: boolean;
  token?: string;
  link?: string;
  metadata?: NetflixMetadata;
  error?: string;
  index?: number;
  rawCookie?: string;
}

interface BatchStats {
  total: number;
  hits: number;
  fails: number;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// ─── Metadata Icon Row ───────────────────────────────────────────────────────

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
      <Icon className="h-4 w-4 text-netflix-muted shrink-0" />
      <span className="text-gray-400">{label}:</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  );
}

// ─── Result Card ─────────────────────────────────────────────────────────────

function ResultCard({ result }: { result: CheckResult }) {
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyToClipboard = useCallback(
    async (text: string, type: "token" | "link") => {
      try {
        await navigator.clipboard.writeText(text);
        if (type === "token") {
          setCopiedToken(true);
          setTimeout(() => setCopiedToken(false), 2000);
        } else {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2000);
        }
        toast.success("¡Copiado al portapapeles!");
      } catch {
        toast.error("No se pudo copiar");
      }
    },
    []
  );

  const m = result.metadata || {};
  const shortId = generateId();

  if (!result.success) {
    return (
      <Card className="border-red-900/40 bg-[#1a1010]">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-red-950/50 flex items-center justify-center shrink-0">
              <X className="h-5 w-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-red-400 font-semibold text-sm">
                Cookie Inválida
              </h4>
              <p className="text-red-300/60 text-xs mt-1 break-words">
                {result.error || "Error desconocido"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-900/40 bg-[#0d1a0d] hover:border-green-800/60 transition-colors">
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-green-950/50 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <CardTitle className="text-green-400 text-sm">
                ✓ Cookie Válida — {shortId}
              </CardTitle>
              <CardDescription className="text-green-600/60 text-xs">
                {m.plan || "Plan Desconocido"}
                {m.countryName ? ` • ${m.countryName}` : ""}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-green-800 text-green-400 text-[10px] shrink-0"
          >
            {m.status || "Activa"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* NFToken Link */}
        {result.link && (
          <div className="bg-black/40 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs text-green-400 font-semibold flex items-center gap-1">
                <Zap className="h-3 w-3" /> NFToken
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-gray-400 hover:text-white hover:bg-white/10"
                  onClick={() =>
                    copyToClipboard(result.link || "", "link")
                  }
                >
                  {copiedLink ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <a
                  href={result.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-6 px-2 inline-flex items-center justify-center rounded text-[10px] text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">
              {result.link}
            </p>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          <MetaRow icon={Globe} label="País" value={m.countryName || m.country} />
          <MetaRow icon={Tv} label="Plan" value={m.plan} />
          <MetaRow icon={Monitor} label="Calidad" value={m.videoQuality} />
          <MetaRow icon={Monitor} label="Pantallas" value={m.maxStreams ? `${m.maxStreams} máximo` : undefined} />
          <MetaRow icon={Calendar} label="Desde" value={m.memberSince} />
          <MetaRow icon={Calendar} label="Próx. Cobro" value={m.nextBilling} />
          <MetaRow icon={Mail} label="Email" value={m.email} />
          <MetaRow icon={Phone} label="Teléfono" value={m.phone} />
          <MetaRow icon={CreditCard} label="Pago" value={m.paymentMethod} />
          <MetaRow icon={User} label="Perfiles" value={m.profiles} />
          <MetaRow icon={Tv} label="Dispositivos" value={m.devices} />
          {m.price && (
            <MetaRow
              icon={CreditCard}
              label="Precio"
              value={`${m.price} ${m.currency || ""}`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Batch Progress ──────────────────────────────────────────────────────────

function BatchProgress({
  stats,
  current,
  total,
}: {
  stats?: BatchStats;
  current: number;
  total: number;
}) {
  const progress = total > 0 ? (current / total) * 100 : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#1F1F1F] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{stats?.total ?? total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-[#0d1a0d] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {stats?.hits ?? 0}
          </div>
          <div className="text-xs text-green-600">Válidas</div>
        </div>
        <div className="bg-[#1a1010] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-400">
            {stats?.fails ?? 0}
          </div>
          <div className="text-xs text-red-600">Inválidas</div>
        </div>
      </div>
      {(current < total || !stats) && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progreso</span>
            <span>
              {current}/{total}
            </span>
          </div>
          <Progress value={progress} className="h-2 bg-[#1F1F1F]" />
        </div>
      )}
    </div>
  );
}

// ─── Batch Result Section with Download ──────────────────────────────────────

function BatchResultsSection({
  results,
  stats,
}: {
  results: CheckResult[];
  stats: BatchStats;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(async () => {
    const validResults = results.filter((r) => r.success);
    if (validResults.length === 0) {
      toast.error("No hay resultados válidos para descargar");
      return;
    }

    setDownloading(true);
    try {
      const zip = new JSZip();

      for (const result of validResults) {
        const m = result.metadata || {};
        const country = m.countryName || m.country || "UNKNOWN";
        const plan = m.plan || "NoPlan";
        const id = generateId();

        const content = [
          `═════════════════════════════════════════`,
          `  Netflix Cookie Checker Pro - Resultado`,
          `═════════════════════════════════════════`,
          ``,
          `ID: ${id}`,
          `Estado: Válido`,
          `NFToken: ${result.token || "N/A"}`,
          `Enlace: ${result.link || "N/A"}`,
          ``,
          `── Metadatos ──────────────────────────`,
          `País: ${m.countryName || m.country || "N/A"}`,
          `Plan: ${m.plan || "N/A"}`,
          ``,
          `── Cookie ─────────────────────────────`,
          `${result.rawCookie || "N/A"}`,
        ].join("\n");

        // Sanitize filename
        const safeCountry = country.replace(/[^a-zA-Z0-9]/g, "_");
        const safePlan = plan.replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${safePlan} ${safeCountry} ${id} Netflix.txt`;
        zip.file(filename, content);
      }

      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `Netflix_Results_${validResults.length}_${Date.now()}.zip`);
      toast.success(
        `¡ZIP descargado con ${validResults.length} resultado(s)!`
      );
    } catch (err: any) {
      toast.error(`Error al generar ZIP: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  }, [results]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-netflix-red" />
          Resultados del Lote ({stats.total})
        </h3>
        {stats.hits > 0 && (
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="bg-green-700 hover:bg-green-600 text-white text-sm"
            size="sm"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Descargar ZIP ({stats.hits})
          </Button>
        )}
      </div>
      <BatchProgress stats={stats} current={stats.total} total={stats.total} />
      <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
        {results.map((result, idx) => (
          <ResultCard key={idx} result={result} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Home() {
  // Single cookie state
  const [cookieText, setCookieText] = useState("");
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<CheckResult | null>(null);

  // Batch state
  const [batchFile, setBatchFile] = useState<File | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchResults, setBatchResults] = useState<CheckResult[]>([]);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Single Cookie Check ──

  const handleSingleCheck = useCallback(async () => {
    if (!cookieText.trim()) {
      toast.error("Por favor, pega una cookie válida");
      return;
    }

    setSingleLoading(true);
    setSingleResult(null);

    try {
      const res = await fetch("/api/check-cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookieText: cookieText.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al verificar la cookie");
        setSingleResult({ success: false, error: data.error });
        return;
      }

      setSingleResult(data);

      if (data.success) {
        toast.success("¡Cookie válida! NFToken generado exitosamente.");
      } else {
        toast.error(data.error || "Cookie inválida");
      }
    } catch (err: any) {
      toast.error("Error de conexión con el servidor");
      setSingleResult({ success: false, error: "Error de conexión" });
    } finally {
      setSingleLoading(false);
    }
  }, [cookieText]);

  // ── Batch Check ──

  const handleBatchCheck = useCallback(async () => {
    if (!batchFile) {
      toast.error("Por favor, selecciona un archivo primero");
      return;
    }

    setBatchLoading(true);
    setBatchResults([]);
    setBatchStats(null);
    setBatchProgress({ current: 0, total: 0 });

    try {
      const formData = new FormData();
      formData.append("file", batchFile);

      const res = await fetch("/api/check-batch", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Error al verificar el lote");
        return;
      }

      setBatchResults(data.results || []);
      setBatchStats(data.stats || { total: 0, hits: 0, fails: 0 });
      setBatchProgress({
        current: data.stats?.total || 0,
        total: data.stats?.total || 0,
      });

      toast.success(
        `Verificación completa: ${data.stats?.hits || 0} válidas, ${data.stats?.fails || 0} inválidas`
      );
    } catch (err: any) {
      toast.error("Error de conexión con el servidor");
    } finally {
      setBatchLoading(false);
    }
  }, [batchFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".txt") || file.name.endsWith(".zip"))) {
      setBatchFile(file);
      toast.success(`Archivo "${file.name}" seleccionado`);
    } else {
      toast.error("Solo se aceptan archivos .txt o .zip");
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setBatchFile(file);
        toast.success(`Archivo "${file.name}" seleccionado`);
      }
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#141414]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#E50914] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Netflix Cookie Checker
                <span className="text-[#E50914] ml-1">Pro</span>
              </h1>
              <p className="text-[10px] text-gray-500">
                Verifica cookies • Genera NFTokens • Extrae metadatos
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="border-[#E50914]/30 text-[#E50914] text-[10px]"
          >
            v2.0
          </Badge>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        <Tabs defaultValue="single" className="space-y-6">
          {/* Tab Navigation */}
          <TabsList className="bg-[#1F1F1F] border border-white/10 w-full h-auto p-1">
            <TabsTrigger
              value="single"
              className="flex-1 py-2.5 text-sm data-[state=active]:bg-[#E50914] data-[state=active]:text-white text-gray-400 transition-all"
            >
              <Search className="h-4 w-4 mr-2" />
              Cookie Individual
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className="flex-1 py-2.5 text-sm data-[state=active]:bg-[#E50914] data-[state=active]:text-white text-gray-400 transition-all"
            >
              <Upload className="h-4 w-4 mr-2" />
              Lote / Archivo
            </TabsTrigger>
          </TabsList>

          {/* ─── Tab 1: Single Cookie ─── */}
          <TabsContent value="single" className="space-y-6">
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">
                  Verificar Cookie Individual
                </CardTitle>
                <CardDescription className="text-gray-500 text-sm">
                  Pega tu cookie de Netflix en cualquier formato: texto plano,
                  Cookie Editor (JSON), o formato Netscape.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={cookieText}
                  onChange={(e) => setCookieText(e.target.value)}
                  placeholder={`Pega tu cookie aquí...\n\nEjemplo (texto plano):\nNetflixId=v1%3B...; SecureNetflixId=v2%3B...; nfvdid=...\n\nEjemplo (JSON Cookie Editor):\n[{"name":"NetflixId","value":"...","domain":".netflix.com"}]`}
                  className="bg-[#0a0a0a] border-white/10 text-white text-sm font-mono placeholder:text-gray-600 min-h-[150px] resize-y focus:border-[#E50914]/50 focus:ring-[#E50914]/20"
                />

                <Button
                  onClick={handleSingleCheck}
                  disabled={singleLoading || !cookieText.trim()}
                  className="w-full bg-[#E50914] hover:bg-[#b2070f] text-white font-semibold h-11 transition-colors disabled:opacity-50"
                >
                  {singleLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando cookie...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Verificar Cookie
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Single Result */}
            {singleLoading && (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full bg-[#1F1F1F] rounded-xl" />
                <Skeleton className="h-20 w-full bg-[#1F1F1F] rounded-xl" />
              </div>
            )}

            {singleResult && !singleLoading && (
              <ResultCard result={singleResult} />
            )}
          </TabsContent>

          {/* ─── Tab 2: Batch ─── */}
          <TabsContent value="batch" className="space-y-6">
            <Card className="border-white/10 bg-[#1F1F1F]">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">
                  Verificación por Lote
                </CardTitle>
                <CardDescription className="text-gray-500 text-sm">
                  Sube un archivo <span className="text-white font-medium">.txt</span> o <span className="text-white font-medium">.zip</span> (con archivos .txt dentro). Máximo 50 cookies por lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop Zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-white/10 hover:border-[#E50914]/40 bg-[#0a0a0a] rounded-xl p-8 text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.zip"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {batchFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="h-10 w-10 text-[#E50914]" />
                      <p className="text-white font-medium text-sm">
                        {batchFile.name}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {(batchFile.size / 1024).toFixed(1)} KB • Click para
                        cambiar
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-10 w-10 text-gray-600" />
                      <p className="text-gray-400 font-medium text-sm">
                        Arrastra tu archivo aquí o click para seleccionar
                      </p>
                      <p className="text-gray-600 text-xs">
                        Formatos aceptados: <span className="text-gray-400">.txt</span> o <span className="text-gray-400">.zip</span>
                      </p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleBatchCheck}
                  disabled={batchLoading || !batchFile}
                  className="w-full bg-[#E50914] hover:bg-[#b2070f] text-white font-semibold h-11 transition-colors disabled:opacity-50"
                >
                  {batchLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando lote... ({batchProgress.current}/
                      {batchProgress.total})
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Verificar Lote
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Batch Progress */}
            {batchLoading && (
              <BatchProgress
                stats={batchStats || undefined}
                current={batchProgress.current}
                total={batchProgress.total || 1}
              />
            )}

            {/* Batch Results */}
            {batchResults.length > 0 && !batchLoading && batchStats && (
              <BatchResultsSection
                results={batchResults}
                stats={batchStats}
              />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center gap-3">
            <p className="text-gray-500 text-xs">
              Netflix Cookie Checker Pro — Desarrollado por <span className="text-white font-semibold">HacheJota</span>
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/524437863111"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/30 transition-colors text-[#25D366] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <a
                href="https://t.me/HcheJotaA_Bot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#229ED9]/10 hover:bg-[#229ED9]/20 border border-[#229ED9]/30 transition-colors text-[#229ED9] text-xs font-medium"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                Telegram
              </a>
            </div>
            <p className="text-gray-700 text-[10px]">
              Uso privado únicamente. No afiliado a Netflix, Inc.
            </p>
          </div>
        </div>
      </footer>

      {/* Global Styles for Custom Scrollbar & Progress */}
      <style jsx global>{`
        :root {
          --netflix-red: #E50914;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        /* Progress bar override */
        [role="progressbar"] > div {
          background-color: #E50914 !important;
        }
      `}</style>
    </div>
  );
}
