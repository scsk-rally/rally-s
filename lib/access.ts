import { getAdminById, getCompanyById } from '@/lib/db'
import { readSession } from '@/lib/security'
import { hasPermission, type AdminPermission } from '@/lib/permissions'
import { headers } from 'next/headers'
import { isAdminRequestAllowed } from '@/lib/admin-ip-access'

export async function requireAdmin() {
  const session = await readSession('admin')
  if (!session) return null
  const admin = await getAdminById(session.subjectId)
  if (!admin || admin.credentialVersion !== session.version) return null
  if (!isAdminRequestAllowed(admin, await headers())) return null
  return admin
}

export async function requireMember() {
  const session = await readSession('member')
  if (!session) return null
  const company = await getCompanyById(session.subjectId)
  if (!company || company.sessionVersion !== session.version) return null
  return company
}

export async function requireOwnerAdmin() {
  const admin = await requireAdmin()
  return admin?.isOwner ? admin : null
}

export async function requireAdminPermission(permission: AdminPermission) {
  const admin = await requireAdmin()
  return admin && hasPermission(admin, permission) ? admin : null
}

export async function requireAnalyticsAdmin() {
  return requireAdminPermission('analytics')
}

export function resolveAnalyticsCompanyId(
  admin: { isOwner: boolean; analyticsCompanyIds: string[] },
  requestedCompanyId: string | null,
) {
  if (admin.isOwner) return requestedCompanyId
  if (!admin.analyticsCompanyIds.length) throw new Error('analytics-company-not-assigned')
  if (requestedCompanyId && !admin.analyticsCompanyIds.includes(requestedCompanyId)) throw new Error('analytics-company-forbidden')
  return requestedCompanyId || admin.analyticsCompanyIds[0]
}

export async function requireViewer() {
  const admin = await requireAdmin()
  if (admin) return { role: 'admin' as const, id: admin.id }
  const company = await requireMember()
  if (company) return { role: 'member' as const, id: company.id }
  return null
}
