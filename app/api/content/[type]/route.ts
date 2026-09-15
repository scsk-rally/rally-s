import { requireAdmin } from '@/lib/access'
import { validateContent } from '@/lib/content'
import { isContentType } from '@/lib/defaults'
import { getContent, saveContent } from '@/lib/db'
import { contentPermission, hasPermission, sectionPermission } from '@/lib/permissions'
import { requireSameOrigin } from '@/lib/security'

export async function PUT(request: Request, { params }: { params: Promise<{ type: string }> }) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdmin()
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { type } = await params
    if (!isContentType(type)) return Response.json({ error: 'unknown-content-type' }, { status: 404 })
    const body = await request.json()
    const items = validateContent(type, body.items)
    if (!admin.isOwner) {
      if (type === 'section') {
        const current = await getContent('section')
        const currentById = new Map(current.map((item) => [item.id, item]))
        const nextById = new Map(items.map((item) => [item.id, item]))
        const changedIds = new Set([...currentById.keys(), ...nextById.keys()].filter((id) => (
          JSON.stringify(currentById.get(id) || null) !== JSON.stringify(nextById.get(id) || null)
        )))
        const forbidden = [...changedIds].some((id) => {
          const permission = sectionPermission[id]
          return !permission || !hasPermission(admin, permission)
        })
        if (forbidden) return Response.json({ error: 'forbidden' }, { status: 403 })
      } else {
        const permission = contentPermission[type]
        if (!permission || !hasPermission(admin, permission)) return Response.json({ error: 'forbidden' }, { status: 403 })
      }
    }
    await saveContent(type, items, admin.id)
    return Response.json({ ok: true, items })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
