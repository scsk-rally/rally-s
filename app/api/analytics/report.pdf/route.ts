import { z } from 'zod'
import { requireAnalyticsAdmin, resolveAnalyticsCompanyId } from '@/lib/access'
import { createAnalyticsPdf } from '@/lib/analytics-pdf'
import { getAnalyticsReport } from '@/lib/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  companyId: z.union([z.literal(''), z.string().uuid()]).optional().default(''),
})

export async function GET(request: Request) {
  const admin = await requireAnalyticsAdmin()
  if (!admin) return Response.json({ error: 'forbidden' }, { status: 403 })
  try {
    const url = new URL(request.url)
    const input = schema.parse({ from: url.searchParams.get('from'), to: url.searchParams.get('to'), companyId: url.searchParams.get('companyId') || '' })
    const start = new Date(`${input.from}T00:00:00Z`)
    const end = new Date(`${input.to}T00:00:00Z`)
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
    if (!Number.isFinite(days) || days < 0 || days > 366) throw new Error('invalid-range')
    const selectedCompanyId = resolveAnalyticsCompanyId(admin, input.companyId || null)
    const report = await getAnalyticsReport(input.from, input.to, selectedCompanyId)
    if (!admin.isOwner) report.companies = report.companies.filter((company) => admin.analyticsCompanyIds.includes(company.id))
    const companyName = selectedCompanyId ? report.companies.find((company) => company.id === selectedCompanyId)?.name || '企業' : '全企業'
    const pdf = await createAnalyticsPdf(report, companyName)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rally-access-report_${input.from}_${input.to}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid-request'
    return Response.json({ error: message }, { status: /forbidden|not-assigned/.test(message) ? 403 : 400 })
  }
}
