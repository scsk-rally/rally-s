import { z } from 'zod'
import { requireAnalyticsAdmin, resolveAnalyticsCompanyId } from '@/lib/access'
import { getAnalyticsReport } from '@/lib/db'

export const dynamic = 'force-dynamic'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const schema = z.object({
  from: z.string().regex(datePattern),
  to: z.string().regex(datePattern),
  companyId: z.union([z.literal(''), z.string().uuid()]).optional().default(''),
})

function validRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
  return Number.isFinite(days) && days >= 0 && days <= 366
}

export async function GET(request: Request) {
  const admin = await requireAnalyticsAdmin()
  if (!admin) return Response.json({ error: 'forbidden' }, { status: 403 })
  try {
    const url = new URL(request.url)
    const input = schema.parse({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      companyId: url.searchParams.get('companyId') || '',
    })
    if (!validRange(input.from, input.to)) throw new Error('invalid-range')
    const selectedCompanyId = resolveAnalyticsCompanyId(admin, input.companyId || null)
    const report = await getAnalyticsReport(input.from, input.to, selectedCompanyId)
    if (!admin.isOwner) report.companies = report.companies.filter((company) => admin.analyticsCompanyIds.includes(company.id))
    return Response.json(report, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid-request'
    return Response.json({ error: message }, { status: /forbidden|not-assigned/.test(message) ? 403 : 400 })
  }
}
