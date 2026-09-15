import { z } from 'zod'
import { requireAdmin, requireOwnerAdmin } from '@/lib/access'
import { adminAccessActions, listAdminAccessLogs, listAdmins, writeAudit, type AdminAccessAction } from '@/lib/db'
import { requestAccessMetadata, requireSameOrigin } from '@/lib/security'

export const dynamic = 'force-dynamic'

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const querySchema = z.object({
  from: z.string().regex(datePattern),
  to: z.string().regex(datePattern),
  adminId: z.string().max(100).optional().default(''),
  action: z.union([z.literal(''), z.enum(adminAccessActions)]).optional().default(''),
  format: z.enum(['json', 'csv']).optional().default('json'),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
})

const pageViewSchema = z.object({ path: z.string().regex(/^\/admin(?:-[a-z]+)*\.html$/).max(100) })

function validRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000)
  return Number.isFinite(days) && days >= 0 && days <= 366
}

const actionLabels: Record<AdminAccessAction, string> = {
  'admin.login': 'ログイン成功',
  'admin.login.success': 'ログイン成功',
  'admin.login.failure': 'ログイン失敗',
  'admin.login.blocked': 'ログイン制限',
  'admin.login.ip-denied': 'IP制限で拒否',
  'admin.logout': 'ログアウト',
  'admin.page.view': '管理画面閲覧',
}

function jstTimestamp(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(new Date(value))
}

function csvCell(value: unknown) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export async function GET(request: Request) {
  const owner = await requireOwnerAdmin()
  if (!owner) return Response.json({ error: 'forbidden' }, { status: 403 })
  try {
    const url = new URL(request.url)
    const input = querySchema.parse({
      from: url.searchParams.get('from'), to: url.searchParams.get('to'),
      adminId: url.searchParams.get('adminId') || '', action: url.searchParams.get('action') || '',
      format: url.searchParams.get('format') || 'json', offset: url.searchParams.get('offset') || '0',
    })
    if (!validRange(input.from, input.to)) throw new Error('invalid-range')
    const result = await listAdminAccessLogs({
      from: input.from, to: input.to, adminId: input.adminId,
      action: input.action, limit: input.format === 'csv' ? 20_000 : 200, offset: input.format === 'csv' ? 0 : input.offset,
    })
    if (input.format === 'csv') {
      const header = ['日時（日本時間）', '管理者ID', '種類', '画面・パス', 'IPアドレス', 'ブラウザ情報']
      const rows = result.logs.map((log) => [
        jstTimestamp(log.occurredAt), log.adminId, actionLabels[log.action], log.path,
        log.ipAddress, log.userAgent,
      ])
      const csv = `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="rally-admin-access-log_${input.from}_${input.to}_JST.csv"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }
    const admins = await listAdmins()
    return Response.json({ ...result, admins: admins.map((admin) => admin.id) }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    const admin = await requireAdmin()
    if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const input = pageViewSchema.parse(await request.json())
    await writeAudit('admin', admin.id, 'admin.page.view', 'page', input.path, {
      path: input.path,
      ...requestAccessMetadata(request),
    })
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'invalid-request' }, { status: 400 })
  }
}
