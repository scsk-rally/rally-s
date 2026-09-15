import { requireMember } from '@/lib/access'

export async function GET() {
  const company = await requireMember()
  if (!company) return Response.json({ authenticated: false }, { status: 401 })
  const name = company.name
  const mark = /^[A-Za-z]/.test(name) ? name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() : Array.from(name)[0]
  return Response.json({ authenticated: true, company: {
    shortName: name, fullName: name, mark: mark || '会', code: '企業コード認証済み',
    pensionName: company.pensionName, pensionUrl: company.pensionUrl,
    stockPlanName: company.stockPlanName, stockPlanUrl: company.stockPlanUrl,
    fpConsultationUrl: company.fpConsultationUrl,
    logoUrl: company.logoUrl,
  } }, { headers: { 'Cache-Control': 'private, no-store' } })
}
