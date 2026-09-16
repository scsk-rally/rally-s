import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { after } from 'next/server'
import { clearLoginAttempts, consumeLoginAttempt, getAdminById, writeAudit } from '@/lib/db'
import { ADMIN_SESSION_MAX_AGE, createSessionToken, requestAccessMetadata, requireSameOrigin, setSessionCookie } from '@/lib/security'
import { isAdminRequestAllowed } from '@/lib/admin-ip-access'

const inputSchema = z.object({ id: z.string().min(3).max(100), password: z.string().min(8).max(256) })

async function logAdminAccess(adminId: string, action: 'admin.login.success' | 'admin.login.failure' | 'admin.login.blocked' | 'admin.login.ip-denied', detail: Record<string, unknown>) {
  try {
    await writeAudit('admin', adminId, action, 'session', null, detail)
  } catch (error) {
    console.error('[admin.access-log] save failed', { action, error: error instanceof Error ? error.message : String(error) })
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const input = inputSchema.parse(await request.json())
    const metadata = requestAccessMetadata(request)
    const clientIp = metadata.ipAddress || 'local'
    const attemptKey = createHash('sha256').update(`admin:${clientIp}:${input.id}`).digest('hex')
    if (!await consumeLoginAttempt(attemptKey)) {
      await logAdminAccess(input.id, 'admin.login.blocked', metadata)
      return Response.json({ ok: false, retryLater: true }, { status: 429 })
    }
    const admin = await getAdminById(input.id)
    const valid = admin ? await bcrypt.compare(input.password, admin.passwordHash) : false
    if (!admin || !valid) {
      await logAdminAccess(input.id, 'admin.login.failure', metadata)
      return Response.json({ ok: false }, { status: 401 })
    }
    if (!isAdminRequestAllowed(admin, request.headers)) {
      await logAdminAccess(admin.id, 'admin.login.ip-denied', metadata)
      return Response.json({ ok: false, ipRestricted: true }, { status: 403 })
    }
    const token = await createSessionToken({
      role: 'admin', subjectId: admin.id, version: admin.credentialVersion,
      isOwner: admin.isOwner, permissions: admin.permissions,
    }, ADMIN_SESSION_MAX_AGE)
    await setSessionCookie('admin', token, ADMIN_SESSION_MAX_AGE)
    after(async () => {
      await Promise.allSettled([
        clearLoginAttempts(attemptKey),
        logAdminAccess(admin.id, 'admin.login.success', metadata),
      ])
    })
    const effectivePermissions = !admin.isOwner && admin.analyticsCompanyIds.length === 0
      ? admin.permissions.filter((permission) => permission !== 'analytics')
      : admin.permissions
    return Response.json({
      ok: true, id: admin.id, isOwner: admin.isOwner, permissions: effectivePermissions,
      analyticsCompanyIds: admin.analyticsCompanyIds,
    })
  } catch (error) {
    console.error('[admin.login] request failed', { error: error instanceof Error ? error.message : String(error) })
    return Response.json({ ok: false }, { status: 400 })
  }
}
