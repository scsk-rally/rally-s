import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { authSecret, isProduction } from '@/lib/env'
import type { AdminPermission } from '@/lib/permissions'

export const ADMIN_COOKIE = 'efukuri_admin_session'
export const MEMBER_COOKIE = 'efukuri_member_session'
export const ANALYTICS_COOKIE = 'efukuri_analytics_session'
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 4
export const MEMBER_SESSION_MAX_AGE = 60 * 60 * 12

export type SessionRole = 'admin' | 'member'
export type SessionPayload = JWTPayload & {
  role: SessionRole
  subjectId: string
  version?: string
  isOwner?: boolean
  permissions?: AdminPermission[]
}

export type CompanyLinkPayload = JWTPayload & {
  kind: 'company-link'
  subjectId: string
  version: string
}

function secretKey() {
  return new TextEncoder().encode(authSecret())
}

export async function createSessionToken(payload: Omit<SessionPayload, keyof JWTPayload>, maxAgeSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secretKey())
}

export async function createCompanyLinkToken(subjectId: string, version: string) {
  // Distribution links must be identical across reads, saves, and deployments.
  // Existing tokens with iat remain valid; revocation uses the stored version.
  return new SignJWT({ kind: 'company-link', subjectId, version })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(secretKey())
}

export async function verifyCompanyLinkToken(token: string | undefined): Promise<CompanyLinkPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (payload.kind !== 'company-link' || typeof payload.subjectId !== 'string' || typeof payload.version !== 'string') return null
    return payload as CompanyLinkPayload
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string | undefined, role: SessionRole): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    if (payload.role !== role || typeof payload.subjectId !== 'string') return null
    if (role === 'admin' && (typeof payload.iat !== 'number' || payload.iat + ADMIN_SESSION_MAX_AGE <= Math.floor(Date.now() / 1000))) return null
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function readSession(role: SessionRole) {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(role === 'admin' ? ADMIN_COOKIE : MEMBER_COOKIE)?.value, role)
}

export async function setSessionCookie(role: SessionRole, token: string, maxAge: number) {
  const cookieStore = await cookies()
  cookieStore.set(role === 'admin' ? ADMIN_COOKIE : MEMBER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge,
  })
}

export async function clearSessionCookie(role: SessionRole) {
  const cookieStore = await cookies()
  cookieStore.set(role === 'admin' ? ADMIN_COOKIE : MEMBER_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 0,
  })
}

export function createAnalyticsSessionId() {
  return randomUUID()
}

export async function readAnalyticsSessionId() {
  const cookieStore = await cookies()
  return cookieStore.get(ANALYTICS_COOKIE)?.value || ''
}

export async function setAnalyticsSessionCookie(value: string) {
  const cookieStore = await cookies()
  cookieStore.set(ANALYTICS_COOKIE, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: MEMBER_SESSION_MAX_AGE,
  })
}

export async function clearAnalyticsSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(ANALYTICS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 0,
  })
}

export function analyticsSessionDigest(value: string) {
  return createHmac('sha256', authSecret()).update(`analytics:${value}`).digest('hex')
}

export function companyCodeDigest(code: string) {
  return createHmac('sha256', authSecret()).update(code.trim().toLowerCase()).digest('hex')
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function createAdminIpProof(ipAddress: string, adminId: string) {
  return createHmac('sha256', authSecret()).update(`admin-ip:${adminId}:${ipAddress}`).digest('hex')
}

export function verifyAdminIpProof(ipAddress: string, adminId: string, proof: string) {
  return safeEqual(createAdminIpProof(ipAddress, adminId), proof)
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return
  const requestUrl = new URL(request.url)
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || requestUrl.host).split(',')[0].trim()
  const protocol = (request.headers.get('x-forwarded-proto') || requestUrl.protocol).split(',')[0].trim().replace(/:$/, '')
  const expected = `${protocol}://${host}`
  let actual = ''
  try { actual = new URL(origin).origin } catch {}
  if (actual !== expected) throw new Error('invalid-origin')
}

export function requestAccessMetadata(request: Request) {
  const forwarded = (request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for'))?.split(',')[0]?.trim()
  const ipAddress = (forwarded || request.headers.get('x-real-ip')?.trim() || '不明').slice(0, 64)
  const userAgent = (request.headers.get('user-agent') || '不明').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500)
  return { ipAddress, userAgent }
}
