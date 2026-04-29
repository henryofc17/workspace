import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
    "nf-checker-hachejota-secret-2024"
);

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export async function createToken(
  payload: JWTPayload
): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      JWT_SECRET
    );

    return payload as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  try {
    const cookieStore = await cookies();

    const token =
      cookieStore.get("auth-token")?.value;

    if (!token) return null;

    return await verifyToken(token);
  } catch {
    return null;
  }
}
