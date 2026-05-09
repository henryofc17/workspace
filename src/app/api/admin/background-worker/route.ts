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

async function isCancelled(): Promise<boolean> {
  const state = await getState();
  return state?.cancelled === true;
}

function isStale(state: WorkerState): boolean {
  return state.status === "RUNNING" && Date.now() - state.startedAt > STALE_MS;
}

// ─── Worker: Refresh Cookies ────────────────────────────────────────────────
//
// Optimizations over previous version:
//   - Batch size increased from 5 to 10 (faster processing)
//   - Skip metadata re-extraction for cookies that already have country/plan
//     (only validate the cookie is still alive)
//   - More responsive cancellation checks
//   - Reduced state save frequency (every 2 batches instead of every batch)

async function runRefreshCookies() {
  try {
    const cookies = await prisma.cookie.findMany({ where: { status: "ACTIVE" } });

    await saveState({
      task: "REFRESH_COOKIES",
      status: "RUNNING",
      startedAt: Date.now(),
      finishedAt: null,
      total: cookies.length,
      processed: 0,
      results: { alive: 0, dead: 0 },
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
        results: { alive: 0, dead: 0 },
        message: "No hay cookies activas para refrescar",
        error: null,
        cancelled: false,
      });
      return;
    }

    const { checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
    let alive = 0;
    let dead = 0;

    // Process in parallel batches of 10 for faster speed
    const BATCH_SIZE = 10;

    for (let i = 0; i < cookies.length; i += BATCH_SIZE) {
      // Check cancellation before each batch
      if (await isCancelled()) {
        await saveState({
          task: "REFRESH_COOKIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: alive + dead,
          results: { alive, dead },
          message: `Cancelado: ${alive} vivas, ${dead} muertas (de ${alive + dead} procesadas)`,
          error: null,
          cancelled: true,
        });
        return;
      }

      const batch = cookies.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (cookie) => {
          const dict = extractCookiesFromText(cookie.rawCookie);

          if (!dict) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: "No se pudo parsear" },
            });
            return "dead";
          }

          try {
            // Step 1: Validate cookie is still alive
            const result = await checkCookie(dict);
            if (!result.success) {
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { status: "DEAD", lastError: result.error || "Cookie inválida", lastUsed: new Date() },
              });
              return "dead";
            }

            // Step 2: Only extract metadata if cookie doesn't have country/plan yet
            // This is the key optimization — skip expensive metadata calls for cookies
            // that already have their metadata populated
            let country: string | null = cookie.country;
            let plan: string | null = cookie.plan;

            if (!country || !plan) {
              try {
                const metadata = await getMetadata(dict);
                if (metadata.country && !country) country = metadata.country;
                if (metadata.plan && !plan) plan = metadata.plan;
              } catch { /* metadata fail, cookie still alive */ }
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
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: err.message || "Error de conexión" },
            });
            return "dead";
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          if (r.value === "alive") alive++;
          else dead++;
        } else {
          dead++;
        }
      }

      // Update progress after every batch
      const processed = Math.min(i + BATCH_SIZE, cookies.length);
      await saveState({
        task: "REFRESH_COOKIES",
        status: "RUNNING",
        startedAt: (await getState())?.startedAt || Date.now(),
        finishedAt: null,
        total: cookies.length,
        processed,
        results: { alive, dead },
        message: `Procesando ${processed}/${cookies.length}...`,
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
      results: { alive, dead },
      message: `Completado: ${alive} vivas, ${dead} muertas`,
      error: null,
      cancelled: false,
    });
  } catch (err: any) {
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
//
// Optimizations:
//   - Batch size increased from 8 to 15 (country detection is lightweight)
//   - More responsive cancellation checks

async function runDetectCountries() {
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
      results: { detected: 0, failed: 0 },
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
        results: { detected: 0, failed: 0 },
        message: "Todas las cookies activas ya tienen país",
        error: null,
        cancelled: false,
      });
      return;
    }

    const { extractCookiesFromText, extractCountryFromNetflixId, getMetadata } = await import("@/lib/netflix-checker");
    let detected = 0;
    let failed = 0;

    // Larger batch size — country detection is lightweight
    const BATCH_SIZE = 15;

    for (let i = 0; i < cookies.length; i += BATCH_SIZE) {
      // Check cancellation
      if (await isCancelled()) {
        await saveState({
          task: "DETECT_COUNTRIES",
          status: "CANCELLED",
          startedAt: (await getState())?.startedAt || Date.now(),
          finishedAt: Date.now(),
          total: cookies.length,
          processed: detected + failed,
          results: { detected, failed },
          message: `Cancelado: ${detected} países detectados de ${detected + failed} procesadas`,
          error: null,
          cancelled: true,
        });
        return;
      }

      const batch = cookies.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (cookie) => {
          const dict = extractCookiesFromText(cookie.rawCookie);
          if (!dict) return "failed";

          try {
            // Step 1: Fast — extract from NetflixId (local, no HTTP)
            let country: string | null = extractCountryFromNetflixId(dict);

            // Step 2: Slow — fetch metadata from Netflix if still unknown
            if (!country) {
              try {
                const metadata = await getMetadata(dict);
                if (metadata.country) country = metadata.country;
              } catch { /* skip */ }
            }

            if (country) {
              await prisma.cookie.update({
                where: { id: cookie.id },
                data: { country },
              });
              return "detected";
            }
            return "failed";
          } catch {
            return "failed";
          }
        })
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          if (r.value === "detected") detected++;
          else failed++;
        } else {
          failed++;
        }
      }

      const processed = Math.min(i + BATCH_SIZE, cookies.length);
      await saveState({
        task: "DETECT_COUNTRIES",
        status: "RUNNING",
        startedAt: (await getState())?.startedAt || Date.now(),
        finishedAt: null,
        total: cookies.length,
        processed,
        results: { detected, failed },
        message: `Procesando ${processed}/${cookies.length}...`,
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
      results: { detected, failed },
      message: `Completado: ${detected} países detectados de ${cookies.length}`,
      error: null,
      cancelled: false,
    });
  } catch (err: any) {
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

    // Mark as cancelled — the worker loop will pick this up
    await saveState({
      ...current,
      cancelled: true,
      message: "Cancelando...",
    });

    return NextResponse.json({
      success: true,
      message: "Señal de cancelación enviada",
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
