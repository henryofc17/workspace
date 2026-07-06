import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getConfigString, setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

// ─── Types ──────────────────────────────────────────────────────────────────

type WorkerTask = "REFRESH_COOKIES" | "DETECT_COUNTRIES";

interface WorkerState {
  task: WorkerTask;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: number;
  finishedAt: number | null;
  total: number;
  processed: number;
  results: Record<string, number>;
  message: string;
  error: string | null;
  cancelled: boolean;
}

const STALE_MS = 30 * 60 * 1000; // 30 min — stale task timeout

// ─── In-memory cancellation flag ─────────────────────────────────────────────
// This is the KEY improvement: cancellation is instant because it's in-memory.
// No DB read needed — the worker checks this variable directly.
let cancelFlag = false;
let workerAbortController: AbortController | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getState(): Promise<WorkerState | null> {
  const raw = await getConfigString("BG_WORKER_STATE", "");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function saveState(state: WorkerState): Promise<void> {
  await setConfig("BG_WORKER_STATE", JSON.stringify(state));
}

async function clearState(): Promise<void> {
  await setConfig("BG_WORKER_STATE", "");
}

function isCancelled(): boolean {
  return cancelFlag;
}

function isStale(state: WorkerState): boolean {
  return state.status === "RUNNING" && Date.now() - state.startedAt > STALE_MS;
}

// ─── Worker: Refresh Cookies ────────────────────────────────────────────────

async function runRefreshCookies() {
  // Create AbortController for this worker run
  const ac = new AbortController();
  workerAbortController = ac;
  cancelFlag = false;

  try {
    const cookies = await prisma.cookie.findMany({ where: { status: "ACTIVE" } });

    await saveState({
      task: "REFRESH_COOKIES",
      status: "RUNNING",
      startedAt: Date.now(),
      finishedAt: null,
      total: cookies.length,
      processed: 0,
      results: { alive: 0, dead: 0, skipped: 0 },
      message: `Procesando ${cookies.length} cookies...`,
      error: null,
      cancelled: false,
    });

    if (cookies.length === 0) {
      await saveState({
        task: "REFRESH_COOKIES",
        status: "COMPLETED",
        startedAt: Date.now(),
        finishedAt: Date.now(),
        total: 0,
        processed: 0,
        results: { alive: 0, dead: 0, skipped: 0 },
        message: "No hay cookies activas para refrescar",
        error: null,
        cancelled: false,
      });
      return;
    }

    const { checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
    let alive = 0;
    let dead = 0;
    let skipped = 0;

    const BATCH_SIZE = 20;
    let batchCount = 0;

    for (let i = 0; i < cookies.length; i += BATCH_SIZE) {
      // Check cancellation — instant in-memory check
      if (isCancelled()) {
        await saveState({
          task: "REFRESH_COOKIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: alive + dead + skipped,
          results: { alive, dead, skipped },
          message: `Cancelado: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`,
          error: null,
          cancelled: true,
        });
        return;
      }

      const batch = cookies.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (cookie) => {
          // Check cancellation INSIDE each cookie handler
          if (isCancelled()) return "cancelled";

          const dict = extractCookiesFromText(cookie.rawCookie);

          if (!dict) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: "No se pudo parsear" },
            });
            return "dead";
          }

          try {
            // Validate cookie is still alive
            const result = await checkCookie(dict, ac.signal);
            if (isCancelled()) return "cancelled";

            if (!result.success) {
              // Transient errors (timeout, connection) — do NOT mark as DEAD
              if (result.isTransient) return "skipped";

              // Only DEAD if Netflix explicitly rejected it
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { status: "DEAD", lastError: result.error || "Cookie inválida", lastUsed: new Date() },
              });
              return "dead";
            }

            // Extract metadata only if missing
            let country: string | null = cookie.country;
            let plan: string | null = cookie.plan;

            if (!country || !plan) {
              try {
                const metadata = await getMetadata(dict, ac.signal);
                if (isCancelled()) return "cancelled";
                if (metadata.country && !country) country = metadata.country;
                if (metadata.plan && !plan) plan = metadata.plan;
              } catch (err: any) {
                if (err.name === "AbortError") return "cancelled";
                // metadata fail, cookie still alive
              }
            }

            // Fallback: extract country from NetflixId (fast, no HTTP)
            if (!country) {
              const fallback = extractCountryFromNetflixId(dict);
              if (fallback) country = fallback;
            }

            await prisma.cookie.update({
              where: { id: cookie.id },
              data: {
                status: "ACTIVE",
                lastUsed: new Date(),
                ...(country && { country }),
                ...(plan && { plan }),
              },
            });
            return "alive";
          } catch (err: any) {
            if (err.name === "AbortError") return "cancelled";
            // Transient failure — don't mark as DEAD
            return "skipped";
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          if (r.value === "alive") alive++;
          else if (r.value === "dead") dead++;
          else if (r.value === "cancelled") { /* counted below */ }
          else skipped++;
        } else {
          skipped++;
        }
      }

      // If cancelled during batch, exit now
      if (isCancelled()) {
        await saveState({
          task: "REFRESH_COOKIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: alive + dead + skipped,
          results: { alive, dead, skipped },
          message: `Cancelado: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`,
          error: null,
          cancelled: true,
        });
        return;
      }

      // Save progress every batch
      batchCount++;
      const processed = Math.min(i + BATCH_SIZE, cookies.length);
      await saveState({
        task: "REFRESH_COOKIES",
        status: "RUNNING",
        startedAt: (await getState())?.startedAt || Date.now(),
        finishedAt: null,
        total: cookies.length,
        processed,
        results: { alive, dead, skipped },
        message: `Procesando ${processed}/${cookies.length}... (${alive} vivas, ${dead} muertas, ${skipped} saltadas)`,
        error: null,
        cancelled: false,
      });
    }

    await saveState({
      task: "REFRESH_COOKIES",
      status: "COMPLETED",
      startedAt: (await getState())?.startedAt || Date.now(),
      finishedAt: Date.now(),
      total: cookies.length,
      processed: cookies.length,
      results: { alive, dead, skipped },
      message: `Completado: ${alive} vivas, ${dead} muertas, ${skipped} saltadas`,
      error: null,
      cancelled: false,
    });
  } catch (err: any) {
    // If cancelled, don't mark as FAILED
    if (isCancelled()) {
      const prev = await getState();
      await saveState({
        task: "REFRESH_COOKIES",
        status: "CANCELLED",
        startedAt: prev?.startedAt || Date.now(),
        finishedAt: Date.now(),
        total: prev?.total || 0,
        processed: prev?.processed || 0,
        results: prev?.results || {},
        message: "Cancelado",
        error: null,
        cancelled: true,
      });
      return;
    }
    const prev = await getState();
    await saveState({
      task: "REFRESH_COOKIES",
      status: "FAILED",
      startedAt: prev?.startedAt || Date.now(),
      finishedAt: Date.now(),
      total: prev?.total || 0,
      processed: prev?.processed || 0,
      results: prev?.results || {},
      message: "Error en refresco",
      error: err.message,
      cancelled: false,
    });
  }
}

// ─── Worker: Detect Countries ───────────────────────────────────────────────
// Two-phase approach for maximum speed:
//   Phase 1: Extract from NetflixId only (INSTANT — no HTTP requests)
//   Phase 2: Only for cookies still without country, fetch metadata (slow HTTP)

async function runDetectCountries() {
  const ac = new AbortController();
  workerAbortController = ac;
  cancelFlag = false;

  try {
    const cookies = await prisma.cookie.findMany({
      where: { status: "ACTIVE", country: null },
    });

    await saveState({
      task: "DETECT_COUNTRIES",
      status: "RUNNING",
      startedAt: Date.now(),
      finishedAt: null,
      total: cookies.length,
      processed: 0,
      results: { detected: 0, skipped: 0 },
      message: `Detectando país en ${cookies.length} cookies...`,
      error: null,
      cancelled: false,
    });

    if (cookies.length === 0) {
      await saveState({
        task: "DETECT_COUNTRIES",
        status: "COMPLETED",
        startedAt: Date.now(),
        finishedAt: Date.now(),
        total: 0,
        processed: 0,
        results: { detected: 0, skipped: 0 },
        message: "Todas las cookies activas ya tienen país",
        error: null,
        cancelled: false,
      });
      return;
    }

    const { extractCookiesFromText, extractCountryFromNetflixId, getMetadata } = await import("@/lib/netflix-checker");
    let detected = 0;
    let skipped = 0;

    // ═══ PHASE 1: NetflixId extraction — INSTANT (no HTTP) ═══
    const needMetadata: typeof cookies = [];

    for (const cookie of cookies) {
      if (isCancelled()) {
        await saveState({
          task: "DETECT_COUNTRIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: detected + skipped,
          results: { detected, skipped },
          message: `Cancelado en Fase 1: ${detected} países detectados`,
          error: null,
          cancelled: true,
        });
        return;
      }

      const dict = extractCookiesFromText(cookie.rawCookie);
      if (!dict) { skipped++; continue; }

      const country = extractCountryFromNetflixId(dict);
      if (country) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { country },
        });
        detected++;
      } else {
        // Queue for Phase 2
        needMetadata.push(cookie);
      }
    }

    // Save Phase 1 progress
    const phase1Processed = detected + skipped;
    await saveState({
      task: "DETECT_COUNTRIES",
      status: "RUNNING",
      startedAt: (await getState())?.startedAt || Date.now(),
      finishedAt: null,
      total: cookies.length,
      processed: phase1Processed,
      results: { detected, skipped },
      message: `Fase 1 lista: ${detected} por NetflixId. Fase 2: ${needMetadata.length} por metadata...`,
      error: null,
      cancelled: false,
    });

    // ═══ PHASE 2: Metadata extraction — HTTP requests (slower) ═══
    if (needMetadata.length === 0) {
      await saveState({
        task: "DETECT_COUNTRIES",
        status: "COMPLETED",
        startedAt: (await getState())?.startedAt || Date.now(),
        finishedAt: Date.now(),
        total: cookies.length,
        processed: cookies.length,
        results: { detected, skipped },
        message: `Completado: ${detected} países detectados (todos por NetflixId), ${skipped} sin detectar`,
        error: null,
        cancelled: false,
      });
      return;
    }

    const META_BATCH_SIZE = 15; // Smaller batch for HTTP requests
    let metaBatchCount = 0;

    for (let i = 0; i < needMetadata.length; i += META_BATCH_SIZE) {
      if (isCancelled()) {
        await saveState({
          task: "DETECT_COUNTRIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: phase1Processed + detected - (needMetadata.length > 0 ? needMetadata.length - i : 0),
          results: { detected, skipped },
          message: `Cancelado en Fase 2: ${detected} países detectados`,
          error: null,
          cancelled: true,
        });
        return;
      }

      const batch = needMetadata.slice(i, i + META_BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (cookie) => {
          if (isCancelled()) return "cancelled";

          const dict = extractCookiesFromText(cookie.rawCookie);
          if (!dict) return "skipped";

          try {
            const metadata = await getMetadata(dict, ac.signal);
            if (isCancelled()) return "cancelled";

            if (metadata.country) {
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { country: metadata.country },
              });
              return "detected";
            }
            return "skipped";
          } catch (err: any) {
            if (err.name === "AbortError") return "cancelled";
            return "skipped";
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          if (r.value === "detected") detected++;
          else if (r.value === "cancelled") { /* skip */ }
          else skipped++;
        } else {
          skipped++;
        }
      }

      // If cancelled during batch, exit now
      if (isCancelled()) {
        await saveState({
          task: "DETECT_COUNTRIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: phase1Processed + i + META_BATCH_SIZE,
          results: { detected, skipped },
          message: `Cancelado: ${detected} países detectados`,
          error: null,
          cancelled: true,
        });
        return;
      }

      // Save progress every batch
      metaBatchCount++;
      const metaProcessed = Math.min(i + META_BATCH_SIZE, needMetadata.length);
      const totalProcessed = phase1Processed + metaProcessed;
      await saveState({
        task: "DETECT_COUNTRIES",
        status: "RUNNING",
        startedAt: (await getState())?.startedAt || Date.now(),
        finishedAt: null,
        total: cookies.length,
        processed: totalProcessed,
        results: { detected, skipped },
        message: `Fase 2: ${metaProcessed}/${needMetadata.length} metadata... (${detected} detectados total)`,
        error: null,
        cancelled: false,
      });
    }

    await saveState({
      task: "DETECT_COUNTRIES",
      status: "COMPLETED",
      startedAt: (await getState())?.startedAt || Date.now(),
      finishedAt: Date.now(),
      total: cookies.length,
      processed: cookies.length,
      results: { detected, skipped },
      message: `Completado: ${detected} países detectados, ${skipped} sin detectar`,
      error: null,
      cancelled: false,
    });
  } catch (err: any) {
    if (isCancelled()) {
      const prev = await getState();
      await saveState({
        task: "DETECT_COUNTRIES",
        status: "CANCELLED",
        startedAt: prev?.startedAt || Date.now(),
        finishedAt: Date.now(),
        total: prev?.total || 0,
        processed: prev?.processed || 0,
        results: prev?.results || {},
        message: "Cancelado",
        error: null,
        cancelled: true,
      });
      return;
    }
    const prev = await getState();
    await saveState({
      task: "DETECT_COUNTRIES",
      status: "FAILED",
      startedAt: prev?.startedAt || Date.now(),
      finishedAt: Date.now(),
      total: prev?.total || 0,
      processed: prev?.processed || 0,
      results: prev?.results || {},
      message: "Error al detectar países",
      error: err.message,
      cancelled: false,
    });
  }
}

// ─── POST — start a background task (fire-and-forget) ──────────────────────

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const body = await request.json();
    const task: WorkerTask = body.task;

    if (task !== "REFRESH_COOKIES" && task !== "DETECT_COUNTRIES") {
      return NextResponse.json({ success: false, error: "Tarea inválida" }, { status: 400 });
    }

    // Check if a task is already running
    const current = await getState();
    if (current && current.status === "RUNNING") {
      if (isStale(current)) {
        await saveState({
          ...current,
          status: "FAILED",
          finishedAt: Date.now(),
          message: "Tarea anterior expirada",
          error: "Task exceeded 30 min timeout",
          cancelled: false,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: "Ya hay una tarea ejecutándose en segundo plano",
          currentTask: current,
        });
      }
    }

    await clearState();

    // Fire-and-forget: do NOT await the worker function
    if (task === "REFRESH_COOKIES") {
      runRefreshCookies();
    } else {
      runDetectCountries();
    }

    return NextResponse.json({
      success: true,
      message: `Tarea iniciada en segundo plano`,
      task,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── DELETE — cancel a running background task ──────────────────────────────
// KEY FIX: Uses in-memory flag + AbortController for INSTANT cancellation

export async function DELETE() {
  try {
    await requireAdmin();

    const current = await getState();
    if (!current || current.status !== "RUNNING") {
      return NextResponse.json({
        success: false,
        error: "No hay tarea ejecutándose",
      });
    }

    // 1. Set in-memory flag — worker checks this instantly, no DB read
    cancelFlag = true;

    // 2. Abort all in-flight HTTP requests immediately
    if (workerAbortController) {
      workerAbortController.abort();
      workerAbortController = null;
    }

    // 3. Also mark in DB for persistence
    await saveState({
      ...current,
      cancelled: true,
      message: "Cancelando...",
    });

    return NextResponse.json({
      success: true,
      message: "Cancelación ejecutada",
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// ─── GET — poll current task status ────────────────────────────────────────

export async function GET() {
  try {
    await requireAdmin();

    const state = await getState();

    // Auto-mark stale tasks
    if (state && isStale(state)) {
      const fixed: WorkerState = {
        ...state,
        status: "FAILED",
        finishedAt: Date.now(),
        error: "Task exceeded 30 min timeout",
        cancelled: false,
      };
      await saveState(fixed);
      return NextResponse.json({ success: true, state: fixed });
    }

    return NextResponse.json({ success: true, state: state || null });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }
    if (err.message === "FORBIDDEN") {
      return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
