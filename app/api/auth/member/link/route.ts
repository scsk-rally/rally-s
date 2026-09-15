import { createHash } from 'node:crypto'
import { clearLoginAttempts, consumeLoginAttempt, getCompanyById, writeAudit } from '@/lib/db'
import { isMemberPagePath } from '@/lib/member-pages'
import { createAnalyticsSessionId, createSessionToken, MEMBER_SESSION_MAX_AGE, setAnalyticsSessionCookie, setSessionCookie, verifyCompanyLinkToken } from '@/lib/security'

function safeReturnTo(value: string | null) {
  const fallback = '/dashboard.html'
  if (!value) return fallback
  try {
    const base = new URL('https://efukuri.invalid')
    const parsed = new URL(value, base)
    if (parsed.origin !== base.origin || !isMemberPagePath(parsed.pathname)) return fallback
    parsed.searchParams.delete('efk_login')
    return parsed.pathname + parsed.search
  } catch {
    return fallback
  }
}

function redirectToLogin(request: Request, returnTo: string) {
  const destination = new URL('/login.html', request.url)
  destination.searchParams.set('linkError', '1')
  if (returnTo !== '/dashboard.html') destination.searchParams.set('returnTo', returnTo)
  return Response.redirect(destination, 303)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const rawToken = url.searchParams.get('token') || ''
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'))
  const link = await verifyCompanyLinkToken(rawToken)
  if (!link) return redirectToLogin(request, returnTo)

  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
    const attemptKey = createHash('sha256').update(`member-link:${clientIp}:${link.subjectId}`).digest('hex')
    if (!await consumeLoginAttempt(attemptKey)) return redirectToLogin(request, returnTo)
    const company = await getCompanyById(link.subjectId)
    if (!company || company.linkVersion !== link.version) return redirectToLogin(request, returnTo)
    await clearLoginAttempts(attemptKey)
    const token = await createSessionToken({ role: 'member', subjectId: company.id, version: company.sessionVersion }, MEMBER_SESSION_MAX_AGE)
    await setSessionCookie('member', token, MEMBER_SESSION_MAX_AGE)
    await setAnalyticsSessionCookie(createAnalyticsSessionId())
    await writeAudit('member', company.id, 'member.link-login', 'session', null, { returnTo })
    return Response.redirect(new URL(returnTo, request.url), 303)
  } catch {
    return redirectToLogin(request, returnTo)
  }
}
