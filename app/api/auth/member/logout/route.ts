import { clearAnalyticsSessionCookie, clearSessionCookie, requireSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
  try { requireSameOrigin(request) } catch { return Response.json({ ok: false }, { status: 403 }) }
  await clearSessionCookie('member')
  await clearAnalyticsSessionCookie()
  return Response.json({ ok: true })
}
