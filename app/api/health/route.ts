import { databaseConfigured } from '@/lib/db'

export async function GET() {
  return Response.json({
    ok: true,
    database: databaseConfigured(),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    authSecret: Boolean(process.env.AUTH_SECRET),
  })
}
