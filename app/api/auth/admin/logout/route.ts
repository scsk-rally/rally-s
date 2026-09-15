import { requireAdmin } from '@/lib/access'
import { writeAudit } from '@/lib/db'
import { clearSessionCookie, requestAccessMetadata, requireSameOrigin } from '@/lib/security'

export async function POST(request: Request) {
  try { requireSameOrigin(request) } catch { return Response.json({ ok: false }, { status: 403 }) }
  const admin = await requireAdmin()
  if (admin) {
    try {
      await writeAudit('admin', admin.id, 'admin.logout', 'session', null, requestAccessMetadata(request))
    } catch (error) {
      console.error('[admin.access-log] logout save failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }
  await clearSessionCookie('admin')
  return Response.json({ ok: true })
}
