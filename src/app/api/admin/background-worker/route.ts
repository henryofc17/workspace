import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getConfigString, setConfig } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { extractCookiesFromText } from "@/lib/netflix-checker";

// ─── Types ──────────────────────────────────────────────────────────────────

type WorkerTask = "REFRESH_COOKIES" | "DETECT_COUNTRIES";

interface WorkerState {
  task: WorkerTask;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: number;
  finishedAt: number | null;
  total: number;
  processed: number;
  results: Record<string, number>;
  message: string;
  error: string | null;
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

function isStale(state: WorkerState): boolean {
  return state.status === "RUNNING" && Date.now() - state.startedAt > STALE_MS;
}

// ─── Worker: Refresh Cookies ────────────────────────────────────────────────

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
      });
      return;
    }

    const { checkCookie, getMetadata, extractCountryFromNetflixId } = await import("@/lib/netflix-checker");
    let alive = 0;
    let dead = 0;

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const dict = extractCookiesFromText(cookie.rawCookie);

      if (!dict) {
        await prisma.cookie.update({
          where: { id: cookie.id },
          data: { status: "DEAD", lastError: "No se pudo parsear" },
        });
        dead++;
      } else {
        try {
          const result = await checkCookie(dict);
          if (!result.success) {
            await prisma.cookie.update({
              where: { id: cookie.id },
              data: { status: "DEAD", lastError: result.error || "Cookie inválida", lastUsed: new Date() },
            });
            dead++;
          } else {
            let country: string | null = null;
            let plan: string | null = null;
            try {
              const metadata = await getMetadata(dict);
              if (metadata.country) country = metadata.country;
              if (metadata.plan) plan = metadata.plan;
            } catch { /* metadata fail, cookie still alive */ }
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
            alive++;
          }
        } catch (err: any) {
          await prisma.cookie.update({
            where: { id: cookie.id },
            data: { status: "DEAD", lastError: err.message || "Error de conexión" },
          });
          dead++;
        }
      }

      // Update progress every 5 cookies
      if ((i + 1) % 5 === 0 || i === cookies.length - 1) {
        await saveState({
          task: "REFRESH_COOKIES",
          status: "RUNNING",
          startedAt: Date.now(),
          finishedAt: null,
          total: cookies.length,
          processed: i + 1,
          results: { alive, dead },
          message: `Procesando ${i + 1}/${cookies.length}...`,
          error: null,
        });
      }
    }

    await saveState({
      task: "REFRESH_COOKIES",
      status: "COMPLETED",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      total: cookies.length,
      processed: cookies.length,
      results: { alive, dead },
      message: `Completado: ${alive} vivas, ${dead} muertas`,
      error: null,
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
    });
  }
}

// ─── Worker: Detect Countries ───────────────────────────────────────────────

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
      });
      return;
    }

    const { extractCookiesFromText, extractCountryFromNetflixId, getMetadata } = await import("@/lib/netflix-checker");
    let detected = 0;
    let failed = 0;

    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const dict = extractCookiesFromText(cookie.rawCookie);

      if (!dict) {
        failed++;
      } else {
        try {
          let country: string | null = extractCountryFromNetflixId(dict);
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
            detected++;
          }
        } catch {
          failed++;
        }
      }

      if ((i + 1) % 5 === 0 || i === cookies.length - 1) {
        await saveState({
          task: "DETECT_COUNTRIES",
          status: "RUNNING",
          startedAt: Date.now(),
          finishedAt: null,
          total: cookies.length,
          processed: i + 1,
          results: { detected, failed },
          message: `Procesando ${i + 1}/${cookies.length}...`,
          error: null,
        });
      }
    }

    await saveState({
      task: "DETECT_COUNTRIES",
      status: "COMPLETED",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      total: cookies.length,
      processed: cookies.length,
      results: { detected, failed },
      message: `Completado: ${detected} países detectados de ${cookies.length}`,
      error: null,
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
        // Mark stale task as failed
        await saveState({
          ...current,
          status: "FAILED",
          finishedAt: Date.now(),
          message: "Tarea anterior expirada",
          error: "Task exceeded 30 min timeout",
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
