import * as bcrypt from 'bcrypt'
import { jwtVerify, SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

const SALT_ROUNDS = 10

// ── Password Hashing ─────────────────────────────────────────────────────────
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS)
}

export async function verifyPassword(plainPassword: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash)
}

// ── JWT Token Management ─────────────────────────────────────────────────────
export interface JWTPayload {
  id: number
  email: string
  role: 'admin' | 'staff'
  [key: string]: any
}

export async function createToken(payload: any): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    return {
      id: verified.payload.id as number,
      email: verified.payload.email as string,
      role: verified.payload.role as 'admin' | 'staff',
    }
  } catch (error) {
    return null
  }
}

// ── Extract Token from Request ────────────────────────────────────────────────
export function getTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null
  const parts = authHeader.split(' ')
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1]
  }
  return null
}

export async function verifyAuthHeader(authHeader: string | null): Promise<JWTPayload | null> {
  const token = getTokenFromHeader(authHeader)
  if (!token) return null
  return verifyToken(token)
}
