import { z } from 'zod'
import { requireMember } from '@/lib/access'
import { recordLinkClick, recordPageView } from '@/lib/db'
import { isMemberAnalyticsPath, isMemberPagePath } from '@/lib/member-pages'
import {
  analyticsSessionDigest,
  createAnalyticsSessionId,
  readAnalyticsSessionId,
  requireSameOrigin,
  setAnalyticsSessionCookie,
} from '@/lib/security'

export const dynamic = 'force-dynamic'

const schema = z.union([
  z.object({ path: z.string().min(1).max(100) }),
  z.object({ kind: z.literal('link'), sourcePath: z.string().min(1).max(100), targetUrl: z.string().min(1).max(2048), label: z.string().min(1).max(200) }),
])

export async function POST(request: Request) {
  try { requireSameOrigin(request) } catch { return Response.json({ error: 'invalid-origin' }, { status: 403 }) }
  const company = await requireMember()
  if (!company) return Response.json({ error: 'unauthorized' }, { status: 401 })
  let input: z.infer<typeof schema>
  try {
    input = schema.parse(await request.json())
    if ('path' in input && !isMemberAnalyticsPath(input.path)) return Response.json({ error: 'invalid-page' }, { status: 400 })
    if ('sourcePath' in input) {
      if (!isMemberPagePath(input.sourcePath)) return Response.json({ error: 'invalid-page' }, { status: 400 })
      const protocol = new URL(input.targetUrl).protocol
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)) return Response.json({ error: 'invalid-link' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'invalid-request' }, { status: 400 })
  }
  try {
    let analyticsSessionId = await readAnalyticsSessionId()
    if (!analyticsSessionId) {
      analyticsSessionId = createAnalyticsSessionId()
      await setAnalyticsSessionCookie(analyticsSessionId)
    }
    const digest = analyticsSessionDigest(analyticsSessionId)
    const pageViews = 'path' in input
      ? await recordPageView(company.id, input.path, digest)
      : await recordLinkClick(company.id, input.sourcePath, input.targetUrl, input.label, digest)
    return Response.json({ ok: true, pageViews }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    console.error('[analytics.pageview] save failed', { event: 'path' in input ? input.path : input.sourcePath, error: error instanceof Error ? error.message : String(error) })
    return Response.json({ error: 'save-failed' }, { status: 500 })
  }
}
