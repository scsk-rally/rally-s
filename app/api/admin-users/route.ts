import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAdmin } from '@/lib/access'
import { createManagedAdmin, deleteManagedAdmin, listAdmins, listCompanies, updateAdminIpRanges, updateManagedAdmin } from '@/lib/db'
import { adminPermissions } from '@/lib/permissions'
import { requireSameOrigin } from '@/lib/security'
import { adminClientIp, isAdminIpAllowed, normalizeAdminIpRanges } from '@/lib/admin-ip-access'

export const dynamic = 'force-dynamic'

const adminId = z.string().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/)
const permission = z.enum(adminPermissions)
const permissions = z.array(permission).min(1).max(adminPermissions.length)
const analyticsCompanyIds = z.array(z.string().uuid()).max(500).refine((ids) => new Set(ids).size === ids.length, 'duplicate-analytics-company')
const allowedIpRanges = z.array(z.string().min(1).max(80)).max(50)

function requireAnalyticsScope(value: { permissions: string[]; analyticsCompanyIds: string[] }, context: z.RefinementCtx) {
  if (value.permissions.includes('analytics') && value.analyticsCompanyIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-company-required' })
  }
  if (!value.permissions.includes('analytics') && value.analyticsCompanyIds.length > 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-permission-required' })
  }
}

const createSchema = z.object({
  id: adminId,
  password: z.string().min(8).max(256),
  permissions,
  analyticsCompanyIds,
  allowedIpRanges,
}).superRefine(requireAnalyticsScope)

const updateSchema = z.object({
  currentId: adminId,
  id: adminId,
  password: z.union([z.literal(''), z.string().min(8).max(256)]),
  permissions,
  analyticsCompanyIds,
  allowedIpRanges,
}).superRefine(requireAnalyticsScope)

const deleteSchema = z.object({ id: adminId })
const ipPolicySchema = z.object({ id: adminId, allowedIpRanges })

async function requireOwner() {
  const admin = await requireAdmin()
  return admin?.isOwner ? admin : null
}

async function responseWithAdmins(request?: Request) {
  const [admins, companies] = await Promise.all([listAdmins(), listCompanies()])
  return Response.json({ admins: admins.map((admin) => ({
    id: admin.id,
    isOwner: admin.isOwner,
    permissions: admin.isOwner ? [...adminPermissions] : admin.permissions,
    analyticsCompanyIds: admin.isOwner ? [] : admin.analyticsCompanyIds,
    allowedIpRanges: admin.allowedIpRanges,
  })), companies: companies.map((company) => ({ id: company.id, name: company.name })), currentIp: request ? adminClientIp(request.headers) : '' }, { headers: { 'Cache-Control': 'private, no-store' } })
}

async function validateCompanyScope(companyIds: string[]) {
  const validIds = new Set((await listCompanies()).map((company) => company.id))
  if (companyIds.some((id) => !validIds.has(id))) throw new Error('analytics-company-not-found')
}

export async function GET(request: Request) {
  if (!await requireOwner()) return Response.json({ error: 'forbidden' }, { status: 403 })
  return responseWithAdmins(request)
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const owner = await requireOwner()
    if (!owner) return Response.json({ error: 'forbidden' }, { status: 403 })
    const input = createSchema.parse(await request.json())
    await validateCompanyScope(input.analyticsCompanyIds)
    const hash = await bcrypt.hash(input.password, 12)
    await createManagedAdmin(input.id, hash, input.permissions, input.analyticsCompanyIds, normalizeAdminIpRanges(input.allowedIpRanges), owner.id)
    return responseWithAdmins(request)
  } catch (error) {
    const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? 'duplicate-admin-id' : error instanceof Error ? error.message : 'invalid-request'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const owner = await requireOwner()
    if (!owner) return Response.json({ error: 'forbidden' }, { status: 403 })
    const input = updateSchema.parse(await request.json())
    await validateCompanyScope(input.analyticsCompanyIds)
    const hash = input.password ? await bcrypt.hash(input.password, 12) : null
    await updateManagedAdmin(input.currentId, input.id, input.permissions, input.analyticsCompanyIds, normalizeAdminIpRanges(input.allowedIpRanges), hash, owner.id)
    return responseWithAdmins(request)
  } catch (error) {
    const message = error instanceof Error && /duplicate|unique/i.test(error.message) ? 'duplicate-admin-id' : error instanceof Error ? error.message : 'invalid-request'
    return Response.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request)
    const owner = await requireOwner()
    if (!owner) return Response.json({ error: 'forbidden' }, { status: 403 })
    const input = ipPolicySchema.parse(await request.json())
    const ranges = normalizeAdminIpRanges(input.allowedIpRanges)
    const target = (await listAdmins()).find((admin) => admin.id === input.id)
    if (!target) throw new Error('admin-not-found')
    if (target.isOwner && ranges.length && !isAdminIpAllowed(adminClientIp(request.headers), ranges)) {
      throw new Error('current-ip-required')
    }
    await updateAdminIpRanges(input.id, ranges, owner.id)
    return responseWithAdmins(request)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request)
    const owner = await requireOwner()
    if (!owner) return Response.json({ error: 'forbidden' }, { status: 403 })
    const input = deleteSchema.parse(await request.json())
    await deleteManagedAdmin(input.id, owner.id)
    return responseWithAdmins(request)
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
