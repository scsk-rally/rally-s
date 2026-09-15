import { z } from 'zod'
import { requireAdminPermission } from '@/lib/access'
import { rotateCompanyLinkVersion } from '@/lib/db'
import { createCompanyLinkToken, requireSameOrigin } from '@/lib/security'

const schema = z.object({ id: z.string().uuid() })

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdminPermission('companies')
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const { id } = schema.parse(await request.json())
    const company = await rotateCompanyLinkVersion(id, admin.id)
    const token = await createCompanyLinkToken(company.id, company.linkVersion)
    return Response.json({ ok: true, fixedLoginPath: `/login.html?efk_login=${encodeURIComponent(token)}` })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
