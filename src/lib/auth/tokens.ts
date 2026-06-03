import { SignJWT, jwtVerify } from "jose";
import { getJwtSecret } from "./env";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export async function signAccessToken(
  userId: string,
  email: string
): Promise<string> {
  return new SignJWT({ email, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(
  token: string
): Promise<AccessTokenPayload | RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AccessTokenPayload | RefreshTokenPayload;
  } catch {
    return null;
  }
}

export async function generateTokenPair(userId: string, email: string) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, email),
    signRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}
