import { put } from '@vercel/blob'
import { requireAdmin } from '@/lib/access'
import { contentPermission, hasPermission, isAdminPermission } from '@/lib/permissions'
import { requireSameOrigin } from '@/lib/security'

const MAX_SIZE = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdmin()
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const form = await request.formData()
    const file = form.get('file')
    const scope = String(form.get('scope') || '')
    const permission = scope === 'company-logo' ? 'companies' : isAdminPermission(scope) ? scope : contentPermission[scope as keyof typeof contentPermission]
    if (!admin.isOwner && (!permission || !hasPermission(admin, permission))) {
      return Response.json({ error: 'forbidden' }, { status: 403 })
    }
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_SIZE) {
      return Response.json({ error: 'invalid-image' }, { status: 400 })
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (process.env.NODE_ENV === 'production') return Response.json({ error: 'blob-not-configured' }, { status: 503 })
      const bytes = Buffer.from(await file.arrayBuffer()).toString('base64')
      return Response.json({ url: `data:${file.type};base64,${bytes}`, localOnly: true })
    }
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '-').slice(-100) || 'image'
    const blob = await put(`cms/${Date.now()}-${safeName}`, file, { access: 'public', addRandomSuffix: true })
    return Response.json({ url: blob.url })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'upload-failed' }, { status: 400 })
  }
}
