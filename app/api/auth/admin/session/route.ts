import { headers } from 'next/headers'
import { getAdminById } from '@/lib/db'
import { isAdminRequestAllowed } from '@/lib/admin-ip-access'
import { readSession } from '@/lib/security'

export async function GET() {
  const session = await readSession('admin')
  if (!session) return Response.json({ authenticated: false }, { status: 401 })
  const admin = await getAdminById(session.subjectId)
  if (!admin || admin.credentialVersion !== session.version) return Response.json({ authenticated: false }, { status: 401 })
  if (!isAdminRequestAllowed(admin, await headers())) {
    return Response.json({ authenticated: false, ipRestricted: true }, { status: 403 })
  }
  const effectivePermissions = admin && !admin.isOwner && admin.analyticsCompanyIds.length === 0
    ? admin.permissions.filter((permission) => permission !== 'analytics')
    : admin?.permissions
  return Response.json({
    authenticated: true, id: admin.id, isOwner: admin.isOwner, permissions: effectivePermissions,
    analyticsCompanyIds: admin.analyticsCompanyIds,
  })
}
