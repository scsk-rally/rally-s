import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { requireAdmin } from '@/lib/access'
import { updateAdminCredentials } from '@/lib/db'
import { clearSessionCookie, requireSameOrigin } from '@/lib/security'

const schema = z.object({ currentPassword: z.string().min(1), newId: z.string().min(3).max(100), newPassword: z.string().min(8).max(256) })

export async function PUT(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdmin()
    if (!admin) return Response.json({ ok: false }, { status: 401 })
    if (!admin.isOwner) return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
    const input = schema.parse(await request.json())
    if (!await bcrypt.compare(input.currentPassword, admin.passwordHash)) {
      return Response.json({ ok: false, reason: 'current-password' }, { status: 400 })
    }
    const hash = await bcrypt.hash(input.newPassword, 12)
    await updateAdminCredentials(admin.id, input.newId, hash)
    await clearSessionCookie('admin')
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }
}
