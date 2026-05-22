import { NextRequest, NextResponse } from "next/server";

// ─── Input Sanitization ──────────────────────────────────────────────────────

/**
 * Strips HTML tags and normalizes input to prevent XSS
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[<>]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Sanitize an object's string fields recursively (max depth 3)
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      );
    } else if (value && typeof value === "object" && Object.keys(value).length > 0) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ─── Rate Limiting (In-Memory, per-IP) ──────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt && now > entry.blockedUntil) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  blockDurationMs: 5 * 60 * 1000,
};

/**
 * Check rate limit for an identifier (usually IP).
 * Returns { allowed: boolean, retryAfter?: number }
 */
export function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; retryAfter?: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + cfg.windowMs,
      blocked: false,
      blockedUntil: 0,
    });
    return { allowed: true };
  }

  if (entry.blocked && now < entry.blockedUntil) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + cfg.windowMs;
    entry.blocked = false;
    entry.blockedUntil = 0;
    return { allowed: true };
  }

  entry.count++;

  if (entry.count > cfg.maxRequests) {
    entry.blocked = true;
    entry.blockedUntil = now + (cfg.blockDurationMs || cfg.windowMs);
    return {
      allowed: false,
      retryAfter: Math.ceil((cfg.blockDurationMs || cfg.windowMs) / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(",").map((ip) => ip.trim());
    return ips[0] || "unknown";
  }
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;
  return "unknown";
}

// ─── Optimized Security Logging ──────────────────────────────────────────────

type LogLevel = "info" | "warn" | "error" | "security";

interface SecurityLogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  ip?: string;
  userId?: string;
  username?: string;
  details?: Record<string, unknown>;
}

/**
 * Log level priority for filtering
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  info: 0,
  warn: 1,
  error: 2,
  security: 3,
};

/**
 * Minimum log level to output.
 * In production: only warn and above to reduce Vercel function log noise.
 * In development: all levels.
 */
const MIN_LOG_LEVEL = process.env.NODE_ENV === "production" ? 1 : 0;

/**
 * Sensitive fields to redact from logs
 */
const SENSITIVE_FIELDS = new Set(["password", "token", "secret", "cookie", "authorization"]);

function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function logSecurityEvent(entry: Omit<SecurityLogEntry, "timestamp">): void {
  // Filter by minimum level
  if (LOG_LEVELS[entry.level] < MIN_LOG_LEVEL) return;

  const log: SecurityLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
    details: entry.details ? redactDetails(entry.details) : undefined,
  };

  // Structured JSON output for production (parseable by log aggregators)
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(log));
    return;
  }

  // Colored output for development
  const prefix = {
    info: "\x1b[36m[SECURITY-INFO]\x1b[0m",
    warn: "\x1b[33m[SECURITY-WARN]\x1b[0m",
    error: "\x1b[31m[SECURITY-ERROR]\x1b[0m",
    security: "\x1b[31m[SECURITY-ALERT]\x1b[0m",
  }[entry.level];

  console.log(
    `${prefix} ${log.event}` +
      (log.ip ? ` | IP: ${log.ip}` : "") +
      (log.userId ? ` | User: ${log.userId}` : "") +
      (log.username ? ` (@${log.username})` : "") +
      (log.details ? ` | ${JSON.stringify(log.details)}` : "")
  );
}

// Predefined security events
export const SecurityEvents = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_BLOCKED: "LOGIN_BLOCKED",
  REGISTER_SUCCESS: "REGISTER_SUCCESS",
  REGISTER_BLOCKED: "REGISTER_BLOCKED",
  TOKEN_REFRESH: "TOKEN_REFRESH",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  ADMIN_ACCESS: "ADMIN_ACCESS",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  SUSPICIOUS_ACTIVITY: "SUSPICIOUS_ACTIVITY",
  CSRF_ATTEMPT: "CSRF_ATTEMPT",
  INPUT_VALIDATION_FAILED: "INPUT_VALIDATION_FAILED",
} as const;

// ─── Request Body Size Guard ─────────────────────────────────────────────────

const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

/**
 * Guard against oversized request bodies
 */
export async function guardBodySize(request: NextRequest): Promise<{ ok: boolean; error?: string }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return { ok: false, error: "Request body too large" };
  }

  try {
    const cloned = request.clone();
    const body = await cloned.json();
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > MAX_BODY_SIZE) {
      return { ok: false, error: "Request body too large" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid request body" };
  }
}

// ─── Security Headers Helper ─────────────────────────────────────────────────

export function getSecurityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Strict-Transport-Security": process.env.NODE_ENV === "production" ? "max-age=31536000; includeSubDomains; preload" : "max-age=300",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://i.ibb.co https://assets.nflxext.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://challenges.cloudflare.com https://www.netflix.com",
      "frame-src https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  };
}

// ─── Cookie Security ─────────────────────────────────────────────────────────

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};
