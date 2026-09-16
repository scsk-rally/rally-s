import { z } from 'zod'
import { createHash } from 'node:crypto'
import { after } from 'next/server'
import { clearLoginAttempts, consumeLoginAttempt, findCompanyByCode, writeAudit } from '@/lib/db'
import { createAnalyticsSessionId, createSessionToken, MEMBER_SESSION_MAX_AGE, requireSameOrigin, setAnalyticsSessionCookie, setSessionCookie } from '@/lib/security'

const schema = z.object({ code: z.string().min(4).max(64) })

function publicCompany(company: NonNullable<Awaited<ReturnType<typeof findCompanyByCode>>>) {
  const name = company.name
  const mark = /^[A-Za-z]/.test(name) ? name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() : Array.from(name)[0]
  return {
    shortName: name, fullName: name, mark: mark || '会', code: '企業コード認証済み',
    pensionName: company.pensionName, pensionUrl: company.pensionUrl,
    stockPlanName: company.stockPlanName, stockPlanUrl: company.stockPlanUrl,
    logoUrl: company.logoUrl,
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const { code } = schema.parse(await request.json())
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const attemptKey = createHash('sha256').update(`member:${clientIp}:${code.trim().toLowerCase()}`).digest('hex')
    if (!await consumeLoginAttempt(attemptKey)) return Response.json({ ok: false, retryLater: true }, { status: 429 })
    const company = await findCompanyByCode(code)
    if (!company) return Response.json({ ok: false }, { status: 401 })
    const token = await createSessionToken({ role: 'member', subjectId: company.id, version: company.sessionVersion }, MEMBER_SESSION_MAX_AGE)
    await setSessionCookie('member', token, MEMBER_SESSION_MAX_AGE)
    await setAnalyticsSessionCookie(createAnalyticsSessionId())
    after(async () => {
      const results = await Promise.allSettled([
        clearLoginAttempts(attemptKey),
        writeAudit('member', company.id, 'member.login', 'session', null, {}),
      ])
      results.forEach((result) => {
        if (result.status === 'rejected') console.error('[member.login] post-response task failed', { error: String(result.reason) })
      })
    })
    return Response.json({ ok: true, company: publicCompany(company) })
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
}
