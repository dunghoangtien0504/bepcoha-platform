import * as bcrypt from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'

// Fail-closed lúc CHẠY (không throw ở top-level để tránh vỡ `next build`
// khi env chưa có trong môi trường build).
function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET chưa được cấu hình (cần ≥32 ký tự ngẫu nhiên)')
  }
  return new TextEncoder().encode(s)
}

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
    .sign(getJwtSecret())
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, getJwtSecret())
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
