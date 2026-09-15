import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { requireOwnerAdmin } from '@/lib/access'
import { validateContent } from '@/lib/content'
import { contentTypes, type ContentItem, type ContentType } from '@/lib/defaults'
import { getContentCollections, listAdmins, listAnalyticsDaily, listCompanies, restoreAnalyticsDaily, restoreBackup, type AdminRecord, type CompanyRecord } from '@/lib/db'
import { isStoredAnalyticsPath } from '@/lib/member-pages'
import { adminPermissions } from '@/lib/permissions'
import { requireSameOrigin } from '@/lib/security'
import { adminClientIp, isAdminIpAllowed, normalizeAdminIpRanges } from '@/lib/admin-ip-access'

export const dynamic = 'force-dynamic'

const companySchema = z.object({
  id: z.string().uuid(),
  codeDigest: z.string().regex(/^[a-f0-9]{64}$/),
  codeHint: z.string().min(1).max(4),
  name: z.string().min(1).max(200),
  pensionName: z.string().max(200),
  pensionUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]),
  fpConsultationUrl: z.union([z.literal(''), z.string().trim().max(2048).url().refine((url) => { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password }, 'FP相談URLは認証情報を含まないhttps://のURLを入力してください')]).default(''),
  stockPlanName: z.string().max(200),
  stockPlanUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]),
  logoUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]).optional().default(''),
  active: z.literal(true),
})

const companyV3Schema = companySchema.extend({
  sessionVersion: z.string().uuid(),
  linkVersion: z.string().uuid(),
})

const managedAdminLegacySchema = z.object({
  id: z.string().min(3).max(50).regex(/^[A-Za-z0-9._-]+$/),
  passwordHash: z.string().min(20).max(200),
  credentialVersion: z.string().min(1).max(100),
  isOwner: z.literal(false),
  permissions: z.array(z.enum(adminPermissions)).min(1).max(adminPermissions.length),
})

const managedAdminSchema = managedAdminLegacySchema.extend({
  analyticsCompanyIds: z.array(z.string().uuid()).max(500).refine((ids) => new Set(ids).size === ids.length, 'duplicate-analytics-company'),
}).superRefine((value, context) => {
  if (value.permissions.includes('analytics') && value.analyticsCompanyIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-company-required' })
  }
  if (!value.permissions.includes('analytics') && value.analyticsCompanyIds.length > 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-permission-required' })
  }
})

const managedAdminV7Schema = managedAdminLegacySchema.extend({
  analyticsCompanyIds: z.array(z.string().uuid()).max(500).refine((ids) => new Set(ids).size === ids.length, 'duplicate-analytics-company'),
  allowedIpRanges: z.array(z.string().min(1).max(80)).max(50),
}).superRefine((value, context) => {
  if (value.permissions.includes('analytics') && value.analyticsCompanyIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-company-required' })
  }
  if (!value.permissions.includes('analytics') && value.analyticsCompanyIds.length > 0) {
    context.addIssue({ code: 'custom', path: ['analyticsCompanyIds'], message: 'analytics-permission-required' })
  }
})

const ownerAccessPolicySchema = z.object({ allowedIpRanges: z.array(z.string().min(1).max(80)).max(50) })

const analyticsDailySchema = z.object({
  companyId: z.string().uuid(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  path: z.string().min(1).max(100).refine((path) => path === '@session' || isStoredAnalyticsPath(path)),
  label: z.string().max(200).optional().default(''),
  pageViews: z.number().int().min(0).max(2_000_000_000),
  uniqueSessions: z.number().int().min(0).max(2_000_000_000),
})

function timestampForFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '00'
  return `${value('year')}-${value('month')}-${value('day')}_${value('hour')}-${value('minute')}-${value('second')}_JST`
}

export async function GET() {
  const admin = await requireOwnerAdmin()
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const content = await getContentCollections()
  const companies = await listCompanies()
  const managedAdmins = (await listAdmins()).filter((item) => !item.isOwner)
  const analyticsDaily = await listAnalyticsDaily()
  const exportedAt = new Date().toISOString()
  const body = JSON.stringify({
    format: 'efukuri-cms-backup',
    version: 7,
    exportedAt,
    scope: {
      contentTypes,
      companies: true,
      managedAdmins: true,
      managedAdminCompanyScopes: true,
      managedAdminIpRestrictions: true,
      ownerIpRestrictions: true,
      ownerCredentials: false,
      auditLog: false,
      mediaFiles: false,
      analyticsDaily: true,
      analyticsSessionDigests: false,
    },
    content,
    companies,
    managedAdmins,
    ownerAccessPolicy: { allowedIpRanges: admin.allowedIpRanges },
    analyticsDaily,
  }, null, 2)

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="rally-backup_${timestampForFilename()}.json"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireOwnerAdmin()
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })

    const body = await request.json() as Record<string, unknown>
    if (body.format !== 'efukuri-cms-backup' || ![1, 2, 3, 4, 5, 6, 7].includes(Number(body.version))) throw new Error('unsupported-backup-format')
    if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) throw new Error('invalid-backup-content')

    const rawContent = body.content as Record<string, unknown>
    const content = {} as Record<ContentType, ContentItem[]>
    for (const type of contentTypes) {
      if (!Object.prototype.hasOwnProperty.call(rawContent, type)) throw new Error(`missing-content-${type}`)
      content[type] = validateContent(type, rawContent[type])
    }
    const rawCompanies = body.version === 3 || body.version === 4 || body.version === 5 || body.version === 6 || body.version === 7
      ? z.array(companyV3Schema).min(1).max(500).parse(body.companies)
      : z.array(companySchema).min(1).max(500).parse(body.companies)
    const companies = rawCompanies.map((company) => ({
      ...company,
      sessionVersion: randomUUID(),
      linkVersion: 'linkVersion' in company ? company.linkVersion : randomUUID(),
    })) as CompanyRecord[]
    const restoredCredentialVersion = new Date().toISOString()
    const managedAdmins = body.version === 2 || body.version === 3 || body.version === 4 || body.version === 5 || body.version === 6 || body.version === 7
      ? ((body.version === 7
          ? z.array(managedAdminV7Schema).max(100).parse(body.managedAdmins)
          : body.version === 6
            ? z.array(managedAdminSchema).max(100).parse(body.managedAdmins).map((item) => ({ ...item, allowedIpRanges: [] }))
            : z.array(managedAdminLegacySchema).max(100).parse(body.managedAdmins).map((item) => ({ ...item, analyticsCompanyIds: [], allowedIpRanges: [] }))) as AdminRecord[]).map((item) => ({
            ...item,
            credentialVersion: restoredCredentialVersion,
            allowedIpRanges: normalizeAdminIpRanges(item.allowedIpRanges),
          }))
      : null
    const ownerAllowedIpRanges = body.version === 7
      ? normalizeAdminIpRanges(ownerAccessPolicySchema.parse(body.ownerAccessPolicy).allowedIpRanges)
      : null
    if (ownerAllowedIpRanges?.length && !isAdminIpAllowed(adminClientIp(request.headers), ownerAllowedIpRanges)) throw new Error('owner-current-ip-required')
    if (managedAdmins?.some((item) => item.id === admin.id)) throw new Error('owner-admin-conflict')
    if (managedAdmins?.some((item) => item.analyticsCompanyIds.some((companyId) => !companies.some((company) => company.id === companyId)))) {
      throw new Error('admin-analytics-company-not-found')
    }
    const analyticsDaily = body.version === 4 || body.version === 5 || body.version === 6 || body.version === 7
      ? z.array(analyticsDailySchema).max(100_000).parse(body.analyticsDaily)
      : null
    if (analyticsDaily?.some((item) => !companies.some((company) => company.id === item.companyId))) throw new Error('analytics-company-not-found')

    await restoreBackup(content, companies, managedAdmins, ownerAllowedIpRanges, admin.id)
    if (analyticsDaily !== null) await restoreAnalyticsDaily(analyticsDaily)
    return Response.json({
      ok: true,
      restoredAt: new Date().toISOString(),
      contentTypes: contentTypes.length,
      companies: companies.length,
      managedAdmins: managedAdmins?.length ?? 0,
      managedAdminsRestored: managedAdmins !== null,
      ownerIpPolicyRestored: ownerAllowedIpRanges !== null,
      analyticsDaily: analyticsDaily?.length ?? 0,
      analyticsRestored: analyticsDaily !== null,
    })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-backup' }, { status: 400 })
  }
}
