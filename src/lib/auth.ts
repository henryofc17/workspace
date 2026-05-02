import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// ─── Config ──────────────────────────────────────────────────────────────────

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-prod-2024"
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_TOKEN_SECRET || "fallback-refresh-secret-change-in-prod-2024"
);

const ACCESS_TOKEN_EXPIRY = "30m";  // Short-lived access token
const REFRESH_TOKEN_EXPIRY = "7d"; // Long-lived refresh token

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Access Token ────────────────────────────────────────────────────────────

export async function createAccessToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ userId: payload.userId, username: payload.username, role: payload.role } as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer("nf-checker")
    .setAudience("nf-checker-api")
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: "nf-checker",
      audience: "nf-checker-api",
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ─── Refresh Token ───────────────────────────────────────────────────────────

export async function createRefreshToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ userId: payload.userId, username: payload.username, role: payload.role } as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setIssuer("nf-checker")
    .setAudience("nf-checker-refresh")
    .sign(REFRESH_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, {
      issuer: "nf-checker",
      audience: "nf-checker-refresh",
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// ─── Create Both Tokens ─────────────────────────────────────────────────────

export async function createTokenPair(payload: JWTPayload): Promise<AuthTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(payload),
    createRefreshToken(payload),
  ]);
  return { accessToken, refreshToken };
}

// ─── Legacy compatibility ────────────────────────────────────────────────────

/** @deprecated Use createAccessToken instead */
export async function createToken(payload: JWTPayload): Promise<string> {
  return createAccessToken(payload);
}

// ─── Session from cookies ────────────────────────────────────────────────────

export async function getSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();

    // Try access token first
    const accessToken = cookieStore.get("access-token")?.value;
    if (accessToken) {
      const payload = await verifyAccessToken(accessToken);
      if (payload) return payload;
    }

    // If access token expired, try refresh token
    const refreshToken = cookieStore.get("refresh-token")?.value;
    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);
      if (payload) {
        // Auto-rotate: issue new access token
        const newAccessToken = await createAccessToken(payload);
        const cookieStore2 = await cookies();
        cookieStore2.set("access-token", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 30 * 60, // 30 min
          path: "/",
        });
        return payload;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Set Auth Cookies ───────────────────────────────────────────────────────

export function setAuthCookies(response: Response, tokens: AuthTokens): void {
  const res = response as any;
  // Access token - short lived
  if (res.cookies?.set) {
    res.cookies.set("access-token", tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 60, // 30 min
      path: "/",
    });
    // Refresh token - long lived
    res.cookies.set("refresh-token", tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });
    // Clear legacy token
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
  }
}

export function clearAuthCookies(response: Response): void {
  const res = response as any;
  if (res.cookies?.set) {
    res.cookies.set("access-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    res.cookies.set("refresh-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0,
      path: "/",
    });
  }
}

// ─── Require Auth (throws 401) ───────────────────────────────────────────────

export async function requireAuth(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return session;
}
