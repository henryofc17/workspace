import { logSecurityEvent, SecurityEvents } from "@/lib/security";

// ─── Config ──────────────────────────────────────────────────────────────────

const SCAMALYTICS_USER = "69fd100acf678";
const SCAMALYTICS_KEY = "ed5bd93e4c5dc656e10a0c4990745a7be152b17c367d5fc96c1ad55a34341704";
const SCAMALYTICS_BASE = "https://api11.scamalytics.com/v3";

const API_TIMEOUT_MS = 3000;   // 3s — don't block the user
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min per IP

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScamalyticsResponse {
  scamalytics: {
    status: string;
    scamalytics_score: number;
    scamalytics_risk: string;
    scamalytics_proxy: {
      is_vpn: boolean;
      is_datacenter: boolean;
      is_apple_icloud_private_relay: boolean;
      is_amazon_aws: boolean;
      is_google: boolean;
    };
    is_blacklisted_external: boolean;
  };
}

export interface IPRiskResult {
  blocked: boolean;
  reason: string | null;
  score: number | null;
  risk: string | null;
  details: Record<string, boolean> | null;
  /** True if the API call failed and we allowed the request (fail-open) */
  apiFailed: boolean;
}

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  result: IPRiskResult;
  expiresAt: number;
}

const ipCache = new Map<string, CacheEntry>();

// Cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of ipCache.entries()) {
    if (now > entry.expiresAt) ipCache.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Core check ──────────────────────────────────────────────────────────────

/**
 * Check if an IP is risky using Scamalytics.
 *
 * Design principles:
 * 1. If the API fails → ALLOW the request (fail-open). Never block on API error.
 * 2. In-memory cache with 15min TTL to avoid hammering the API.
 * 3. 3s timeout on the API call.
 * 4. Block on: VPN, datacenter proxy (non-Google/AWS), blacklist, score >= 75.
 * 5. Allow Google/AWS datacenters — they're common legitimate users.
 */
export async function checkIPRisk(ip: string): Promise<IPRiskResult> {
  // Skip for obvious non-real IPs
  if (!ip || ip === "unknown" || ip === "::1" || ip === "127.0.0.1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { blocked: false, reason: null, score: null, risk: null, details: null, apiFailed: false };
  }

  // Check cache
  const cached = ipCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const url = `${SCAMALYTICS_BASE}/${SCAMALYTICS_USER}/?key=${SCAMALYTICS_KEY}&ip=${encodeURIComponent(ip)}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      // API error — fail-open
      return { blocked: false, reason: null, score: null, risk: null, details: null, apiFailed: true };
    }

    const data: ScamalyticsResponse = await res.json();
    const s = data.scamalytics;

    if (s.status !== "ok") {
      return { blocked: false, reason: null, score: null, risk: null, details: null, apiFailed: true };
    }

    const score = s.scamalytics_score;
    const risk = s.scamalytics_risk;
    const proxy = s.scamalytics_proxy;
    const blacklisted = s.is_blacklisted_external;

    const reasons: string[] = [];
    const details: Record<string, boolean> = {
      vpn: proxy.is_vpn,
      datacenter: proxy.is_datacenter,
      blacklist: blacklisted,
      google: proxy.is_google,
      aws: proxy.is_amazon_aws,
      appleRelay: proxy.is_apple_icloud_private_relay,
    };

    // Block conditions
    // 1. VPN detected
    if (proxy.is_vpn) {
      reasons.push("VPN detectada");
    }

    // 2. Datacenter IP — but allow Google/AWS (common mobile users via cloud)
    if (proxy.is_datacenter && !proxy.is_google && !proxy.is_amazon_aws) {
      reasons.push("IP de datacenter/proxy");
    }

    // 3. Blacklisted externally
    if (blacklisted) {
      reasons.push("IP en lista negra");
    }

    // 4. High fraud score
    if (score >= 75) {
      reasons.push(`Score de fraude alto (${score})`);
    }

    const blocked = reasons.length > 0;
    const result: IPRiskResult = {
      blocked,
      reason: blocked ? reasons.join(", ") : null,
      score,
      risk,
      details,
      apiFailed: false,
    };

    // Cache result
    ipCache.set(ip, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    // Log if blocked
    if (blocked) {
      logSecurityEvent({
        level: "error",
        event: "IP_BLOCKED_RISK",
        ip,
        details: { score, risk, reasons, proxy, blacklisted },
      });
    }

    return result;
  } catch (err: any) {
    // Timeout, network error, parse error → FAIL-OPEN
    // Log but don't block
    console.warn(`[IP-GUARD] API call failed for ${ip}: ${err.message || "unknown error"} — allowing request`);
    return { blocked: false, reason: null, score: null, risk: null, details: null, apiFailed: true };
  }
}
