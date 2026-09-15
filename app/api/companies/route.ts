import { z } from 'zod'
import { requireAdminPermission } from '@/lib/access'
import { listCompanies, replaceCompanies } from '@/lib/db'
import { createCompanyLinkToken, requireSameOrigin } from '@/lib/security'

const companySchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().max(64).optional(),
  name: z.string().min(1).max(200),
  pensionName: z.string().max(200).optional(),
  pensionUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]).optional(),
  stockPlanName: z.string().max(200).optional(),
  stockPlanUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]).optional(),
  fpConsultationUrl: z.union([z.literal(''), z.string().trim().max(2048).url().refine((url) => { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password }, 'FP相談URLは認証情報を含まないhttps://のURLを入力してください')]).optional(),
  logoUrl: z.union([z.literal(''), z.string().url().refine((url) => /^https?:\/\//i.test(url))]).optional(),
})

async function publicCompanies() {
  const companies = await listCompanies()
  return Promise.all(companies.map(async (company) => ({
    id: company.id,
    code: `••••${company.codeHint}`,
    name: company.name,
    pensionName: company.pensionName,
    pensionUrl: company.pensionUrl,
    stockPlanName: company.stockPlanName,
    stockPlanUrl: company.stockPlanUrl,
    fpConsultationUrl: company.fpConsultationUrl,
    logoUrl: company.logoUrl,
    fixedLoginPath: `/login.html?efk_login=${encodeURIComponent(await createCompanyLinkToken(company.id, company.linkVersion))}`,
  })))
}

export async function GET() {
  const admin = await requireAdminPermission('companies')
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
  return Response.json({ companies: await publicCompanies() }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdminPermission('companies')
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const body = await request.json()
    const companies = z.array(companySchema).min(1).max(500).parse(body.companies)
    for (const company of companies) {
      if (!company.id && !company.code) throw new Error('company-code-required')
      if (company.code && !company.code.startsWith('••••') && !/^[a-z0-9_-]{4,32}$/i.test(company.code)) throw new Error('invalid-company-code')
    }
    await replaceCompanies(companies, admin.id)
    return Response.json({ companies: await publicCompanies() }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
