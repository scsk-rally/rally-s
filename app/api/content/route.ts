import { requireAdmin, requireViewer } from '@/lib/access'
import { publishedCollections, validateContent } from '@/lib/content'
import { contentTypes, isContentType, type ContentItem, type ContentType } from '@/lib/defaults'
import { getContent, getContentCollections, saveContentBatch } from '@/lib/db'
import { contentPermission, hasPermission, sectionPermission } from '@/lib/permissions'
import { requireSameOrigin } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const viewer = await requireViewer()
  if (!viewer) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const mode = new URL(request.url).searchParams.get('mode')
  const collections = await getContentCollections()
  if (mode === 'all') {
    const admin = await requireAdmin()
    if (!admin) return Response.json({ error: 'forbidden' }, { status: 403 })
    if (!admin.isOwner) {
      for (const type of contentTypes) {
        if (type === 'section') {
          collections.section = collections.section.filter((item) => {
            const permission = sectionPermission[item.id]
            return Boolean(permission && hasPermission(admin, permission))
          })
        } else {
          const permission = contentPermission[type]
          if (!permission || !hasPermission(admin, permission)) delete (collections as Partial<Record<ContentType, ContentItem[]>>)[type]
        }
      }
    }
    return Response.json({ content: collections }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  return Response.json({ content: publishedCollections(collections) }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdmin()
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const body = await request.json() as { collections?: Record<string, unknown> }
    if (!body.collections || typeof body.collections !== 'object' || Array.isArray(body.collections)) throw new Error('invalid-collections')
    const keys = Object.keys(body.collections)
    if (!keys.length || keys.length > contentTypes.length || keys.some((type) => !isContentType(type))) throw new Error('invalid-collections')
    const updates: Partial<Record<ContentType, ContentItem[]>> = {}
    for (const rawType of keys) {
      const type = rawType as ContentType
      const items = validateContent(type, body.collections[type])
      if (!admin.isOwner) {
        if (type === 'section') {
          const allowedIds = new Set(Object.entries(sectionPermission).filter(([, permission]) => hasPermission(admin, permission)).map(([id]) => id))
          if (items.some((item) => !allowedIds.has(item.id))) return Response.json({ error: 'forbidden' }, { status: 403 })
          const current = await getContent('section')
          const incoming = new Map(items.map((item) => [item.id, item]))
          updates.section = current.map((item) => incoming.get(item.id) || item)
          continue
        }
        const permission = contentPermission[type]
        if (!permission || !hasPermission(admin, permission)) return Response.json({ error: 'forbidden' }, { status: 403 })
      }
      updates[type] = items
    }
    if (updates.seminar && !updates.notice) {
      const notices = await getContent('notice')
      const noticeById = new Map(notices.map((item) => [item.id, item]))
      let changed = false
      for (const seminar of updates.seminar) {
        if (!seminar.noticeId) continue
        const notice = noticeById.get(String(seminar.noticeId))
        if (!notice) continue
        const nextNotice = {
          ...notice,
          title: seminar.title,
          body: String(seminar.summary || '').replace(/\r?\n/g, ' '),
          visible: seminar.visible,
          startAt: seminar.startAt,
          endAt: seminar.endAt,
          updatedAt: seminar.updatedAt,
        }
        if (JSON.stringify(notice) !== JSON.stringify(nextNotice)) {
          noticeById.set(notice.id, nextNotice)
          changed = true
        }
      }
      if (changed) updates.notice = notices.map((item) => noticeById.get(item.id) || item)
    }
    if (updates.notice && !updates.seminar) {
      const remainingNoticeIds = new Set(updates.notice.map((item) => item.id))
      const seminars = await getContent('seminar')
      let changed = false
      const nextSeminars = seminars.map((seminar) => {
        if (!seminar.noticeId || remainingNoticeIds.has(String(seminar.noticeId))) return seminar
        changed = true
        return { ...seminar, noticeId: '', postToNotice: false, updatedAt: new Date().toISOString() }
      })
      if (changed) updates.seminar = nextSeminars
    }
    await saveContentBatch(updates, admin.id)
    return Response.json({ ok: true, collections: updates })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
