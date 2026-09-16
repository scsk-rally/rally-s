import { createHash, randomUUID } from 'node:crypto'
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
import { cloneDefaultContent, contentTypes, developmentCompanies, type ContentItem, type ContentType } from '@/lib/defaults'
import { configuredCompanies, databaseUrl, initialAdmin, isProduction, type InitialCompany } from '@/lib/env'
import { companyCodeDigest } from '@/lib/security'
import { adminPermissions, normalizePermissions, type AdminPermission } from '@/lib/permissions'
import { memberAnalyticsLabels } from '@/lib/member-pages'
import { normalizeAdminIpRanges } from '@/lib/admin-ip-access'

export type CompanyRecord = {
  id: string
  codeDigest: string
  codeHint: string
  name: string
  pensionName: string
  pensionUrl: string
  stockPlanName: string
  fpConsultationUrl: string
  stockPlanUrl: string
  logoUrl: string
  active: boolean
  sessionVersion: string
  linkVersion: string
}

export type AdminRecord = {
  id: string
  passwordHash: string
  credentialVersion: string
  isOwner: boolean
  permissions: AdminPermission[]
  analyticsCompanyIds: string[]
  allowedIpRanges: string[]
}

export type AnalyticsDailyRecord = {
  companyId: string
  eventDate: string
  path: string
  label: string
  pageViews: number
  uniqueSessions: number
}

export type AnalyticsReport = {
  range: { from: string; to: string }
  selectedCompanyId: string | null
  companies: Array<{ id: string; name: string }>
  summary: { logins: number; codeLogins: number; linkLogins: number; pageViews: number; uniqueSessions: number }
  daily: Array<{ date: string; logins: number; pageViews: number; uniqueSessions: number }>
  pages: Array<{ path: string; label: string; pageViews: number; uniqueSessions: number }>
  companyRows: Array<{ companyId: string; companyName: string; logins: number; codeLogins: number; linkLogins: number; pageViews: number; uniqueSessions: number }>
}

export const adminAccessActions = [
  'admin.login',
  'admin.login.success',
  'admin.login.failure',
  'admin.login.blocked',
  'admin.login.ip-denied',
  'admin.logout',
  'admin.page.view',
] as const

export type AdminAccessAction = typeof adminAccessActions[number]
export type AdminAccessLogEntry = {
  id: string
  occurredAt: string
  adminId: string
  action: AdminAccessAction
  path: string
  ipAddress: string
  userAgent: string
}

type MemoryAuditRecord = {
  id: number
  actorType: string
  actorId: string
  action: string
  targetType: string
  targetId: string | null
  detail: Record<string, unknown>
  createdAt: string
}

const memory = {
  initialized: false,
  content: cloneDefaultContent(),
  companies: [] as CompanyRecord[],
  admins: [] as AdminRecord[],
  loginAttempts: new Map<string, { count: number; startedAt: number }>(),
  analyticsDaily: [] as AnalyticsDailyRecord[],
  analyticsUnique: new Set<string>(),
  auditLog: [] as MemoryAuditRecord[],
  nextAuditId: 1,
}

let sqlClient: NeonQueryFunction<false, false> | null = null
let schemaPromise: Promise<void> | null = null
const schemaVersion = '2026-09-16-1'

function getSql() {
  const url = databaseUrl()
  if (!url) return null
  if (!sqlClient) sqlClient = neon(url)
  return sqlClient
}

function normalizeCompany(company: InitialCompany): CompanyRecord {
  const code = company.code.trim().toLowerCase()
  return {
    id: randomUUID(),
    codeDigest: companyCodeDigest(code),
    codeHint: code.slice(-4),
    name: company.name.trim(),
    pensionName: company.pensionName?.trim() || '',
    pensionUrl: company.pensionUrl?.trim() || '',
    stockPlanName: company.stockPlanName?.trim() || '',
    stockPlanUrl: company.stockPlanUrl?.trim() || '',
    fpConsultationUrl: company.fpConsultationUrl?.trim() || '',
    logoUrl: '',
    active: true,
    sessionVersion: randomUUID(),
    linkVersion: randomUUID(),
  }
}

function retiredCompanyDigest() {
  return createHash('sha256').update(`retired-company:${randomUUID()}`).digest('hex')
}

async function initializeMemory() {
  if (memory.initialized) return
  const initial = configuredCompanies()
  const companies = initial.length ? initial : (!isProduction() ? developmentCompanies : [])
  memory.companies = companies.map(normalizeCompany)
  const admin = initialAdmin()
  if (admin.id && admin.password) {
    memory.admins = [{
      id: admin.id,
      passwordHash: await bcrypt.hash(admin.password, 12),
      credentialVersion: new Date().toISOString(),
      isOwner: true,
      permissions: [...adminPermissions],
      analyticsCompanyIds: [],
      allowedIpRanges: [],
    }]
  }
  memory.initialized = true
}

export async function ensureSchema() {
  const sql = getSql()
  if (!sql) {
    await initializeMemory()
    return
  }
  if (!schemaPromise) {
    schemaPromise = (async () => {
      // A serverless instance starts with an empty module cache.  Avoid replaying
      // the full DDL migration on every cold start once this database is ready.
      const migrationTable = await sql`SELECT to_regclass('public.efukuri_schema_migrations') AS name`
      if (migrationTable[0]?.name) {
        const applied = await sql`SELECT 1 FROM efukuri_schema_migrations WHERE version = ${schemaVersion}`
        if (applied.length) return
      } else {
        await sql`CREATE TABLE IF NOT EXISTS efukuri_schema_migrations (
          version text PRIMARY KEY,
          applied_at timestamptz NOT NULL DEFAULT now()
        )`
      }

      await sql`CREATE TABLE IF NOT EXISTS efukuri_content_collections (
        type text PRIMARY KEY,
        items jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_companies (
        id uuid PRIMARY KEY,
        code_digest text NOT NULL UNIQUE,
        code_hint text NOT NULL,
        name text NOT NULL,
        pension_name text NOT NULL DEFAULT '',
        pension_url text NOT NULL DEFAULT '',
        stock_plan_name text NOT NULL DEFAULT '',
        stock_plan_url text NOT NULL DEFAULT '',
        fp_consultation_url text NOT NULL DEFAULT '',
        logo_url text NOT NULL DEFAULT '',
        active boolean NOT NULL DEFAULT true,
        session_version text NOT NULL DEFAULT '',
        link_version text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_admin_users (
        id text PRIMARY KEY,
        password_hash text NOT NULL,
        credential_version text NOT NULL,
        is_owner boolean NOT NULL DEFAULT false,
        permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
        allowed_ip_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`ALTER TABLE efukuri_companies ADD COLUMN IF NOT EXISTS fp_consultation_url text NOT NULL DEFAULT ''`
      await sql`ALTER TABLE efukuri_companies ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT ''`
      await sql`ALTER TABLE efukuri_companies ADD COLUMN IF NOT EXISTS session_version text NOT NULL DEFAULT ''`
      await sql`ALTER TABLE efukuri_companies ADD COLUMN IF NOT EXISTS link_version text NOT NULL DEFAULT ''`
      const companiesMissingVersions = await sql`SELECT id, session_version, link_version FROM efukuri_companies WHERE session_version = '' OR link_version = ''`
      for (const company of companiesMissingVersions) {
        const sessionVersion = String(company.session_version || '') || randomUUID()
        const linkVersion = String(company.link_version || '') || randomUUID()
        await sql`UPDATE efukuri_companies SET session_version = ${sessionVersion}, link_version = ${linkVersion}, updated_at = now() WHERE id = ${String(company.id)}::uuid`
      }
      await sql`ALTER TABLE efukuri_admin_users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false`
      await sql`ALTER TABLE efukuri_admin_users ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb`
      await sql`ALTER TABLE efukuri_admin_users ADD COLUMN IF NOT EXISTS allowed_ip_ranges jsonb NOT NULL DEFAULT '[]'::jsonb`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_admin_company_scopes (
        admin_id text NOT NULL REFERENCES efukuri_admin_users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        permission text NOT NULL,
        company_id uuid NOT NULL REFERENCES efukuri_companies(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (admin_id, permission, company_id),
        CHECK (permission = 'analytics')
      )`
      await sql`CREATE INDEX IF NOT EXISTS efukuri_admin_company_scopes_company_idx ON efukuri_admin_company_scopes (company_id, permission)`
      await sql`UPDATE efukuri_admin_users SET is_owner = true, permissions = ${JSON.stringify(adminPermissions)}::jsonb
        WHERE id = (SELECT id FROM efukuri_admin_users ORDER BY updated_at ASC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM efukuri_admin_users WHERE is_owner = true)`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_audit_log (
        id bigserial PRIMARY KEY,
        actor_type text NOT NULL,
        actor_id text NOT NULL,
        action text NOT NULL,
        target_type text NOT NULL,
        target_id text,
        detail jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE INDEX IF NOT EXISTS efukuri_audit_log_admin_access_idx
        ON efukuri_audit_log (created_at DESC, actor_id) WHERE actor_type = 'admin'`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_content_versions (
        id bigserial PRIMARY KEY,
        type text NOT NULL,
        items jsonb NOT NULL,
        actor_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_login_attempts (
        key text PRIMARY KEY,
        attempts integer NOT NULL DEFAULT 1,
        window_started_at timestamptz NOT NULL DEFAULT now()
      )`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_analytics_daily (
        company_id uuid NOT NULL REFERENCES efukuri_companies(id) ON DELETE CASCADE,
        event_date date NOT NULL,
        path text NOT NULL,
        label text NOT NULL DEFAULT '',
        page_views integer NOT NULL DEFAULT 0,
        unique_sessions integer NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (company_id, event_date, path)
      )`
      await sql`ALTER TABLE efukuri_analytics_daily ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT ''`
      await sql`CREATE TABLE IF NOT EXISTS efukuri_analytics_unique_daily (
        company_id uuid NOT NULL REFERENCES efukuri_companies(id) ON DELETE CASCADE,
        event_date date NOT NULL,
        path text NOT NULL,
        session_digest text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (company_id, event_date, path, session_digest)
      )`
      await sql`CREATE INDEX IF NOT EXISTS efukuri_analytics_daily_date_idx ON efukuri_analytics_daily (event_date, company_id)`
      await sql`CREATE INDEX IF NOT EXISTS efukuri_analytics_unique_date_idx ON efukuri_analytics_unique_daily (event_date, company_id)`

      for (const type of contentTypes) {
        const items = JSON.stringify(cloneDefaultContent()[type])
        await sql`INSERT INTO efukuri_content_collections (type, items)
          VALUES (${type}, ${items}::jsonb)
          ON CONFLICT (type) DO NOTHING`
      }

      const companyCount = await sql`SELECT count(*)::int AS count FROM efukuri_companies`
      if (Number(companyCount[0]?.count || 0) === 0) {
        for (const company of configuredCompanies()) {
          const record = normalizeCompany(company)
          await sql`INSERT INTO efukuri_companies
            (id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version)
            VALUES (${record.id}, ${record.codeDigest}, ${record.codeHint}, ${record.name}, ${record.pensionName}, ${record.pensionUrl}, ${record.stockPlanName}, ${record.stockPlanUrl}, ${record.fpConsultationUrl}, ${record.logoUrl}, true, ${record.sessionVersion}, ${record.linkVersion})
            ON CONFLICT (code_digest) DO NOTHING`
        }
      }

      const adminCount = await sql`SELECT count(*)::int AS count FROM efukuri_admin_users`
      const admin = initialAdmin()
      if (Number(adminCount[0]?.count || 0) === 0 && admin.id && admin.password) {
        const hash = await bcrypt.hash(admin.password, 12)
        const version = new Date().toISOString()
        await sql`INSERT INTO efukuri_admin_users (id, password_hash, credential_version, is_owner, permissions)
          VALUES (${admin.id}, ${hash}, ${version}, true, ${JSON.stringify(adminPermissions)}::jsonb) ON CONFLICT (id) DO NOTHING`
      }
      await sql`INSERT INTO efukuri_schema_migrations (version) VALUES (${schemaVersion}) ON CONFLICT (version) DO NOTHING`
    })()
  }
  return schemaPromise
}

export function databaseConfigured() {
  return Boolean(databaseUrl())
}

export async function getContent(type: ContentType): Promise<ContentItem[]> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.content[type])
  const rows = await sql`SELECT items FROM efukuri_content_collections WHERE type = ${type}`
  return structuredClone((rows[0]?.items || []) as ContentItem[])
}

export async function getContentCollections(): Promise<Record<ContentType, ContentItem[]>> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.content)
  const rows = await sql`SELECT type, items FROM efukuri_content_collections`
  const byType = new Map(rows.map((row) => [String(row.type), row.items]))
  return Object.fromEntries(contentTypes.map((type) => [type, structuredClone(byType.get(type) || [])])) as Record<ContentType, ContentItem[]>
}

export async function saveContent(type: ContentType, items: ContentItem[], actorId: string) {
  await saveContentBatch({ [type]: items } as Partial<Record<ContentType, ContentItem[]>>, actorId)
}

export async function saveContentBatch(updates: Partial<Record<ContentType, ContentItem[]>>, actorId: string) {
  await ensureSchema()
  const entries = contentTypes.flatMap((type) => updates[type] ? [[type, updates[type]!] as const] : [])
  if (!entries.length) return
  const sql = getSql()
  if (!sql) {
    for (const [type, items] of entries) memory.content[type] = structuredClone(items)
    return
  }
  await sql.transaction((txn) => {
    const queries = entries.flatMap(([type, items]) => {
      const json = JSON.stringify(items)
      return [
        txn`INSERT INTO efukuri_content_versions (type, items, actor_id) VALUES (${type}, ${json}::jsonb, ${actorId})`,
        txn`INSERT INTO efukuri_content_collections (type, items, updated_at)
          VALUES (${type}, ${json}::jsonb, now())
          ON CONFLICT (type) DO UPDATE SET items = EXCLUDED.items, updated_at = now()`,
      ]
    })
    const detail = JSON.stringify(Object.fromEntries(entries.map(([type, items]) => [type, items.length])))
    queries.push(txn`INSERT INTO efukuri_audit_log (actor_type, actor_id, action, target_type, target_id, detail)
      VALUES ('admin', ${actorId}, 'content.batch-save', 'content', null, ${detail}::jsonb)`)
    return queries
  })
}

export async function restoreBackup(
  content: Record<ContentType, ContentItem[]>,
  companies: CompanyRecord[],
  managedAdmins: AdminRecord[] | null,
  ownerAllowedIpRanges: string[] | null,
  actorId: string,
) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) {
    memory.content = structuredClone(content)
    const restoredById = new Map(companies.map((company) => [company.id, structuredClone({ ...company, active: true })]))
    memory.companies = memory.companies.map((company) => {
      const restored = restoredById.get(company.id)
      if (restored) {
        restoredById.delete(company.id)
        return restored
      }
      return {
        ...company,
        codeDigest: retiredCompanyDigest(),
        codeHint: '',
        active: false,
        sessionVersion: randomUUID(),
        linkVersion: randomUUID(),
      }
    }).concat(Array.from(restoredById.values()))
    const activeCompanyIds = new Set(companies.map((company) => company.id))
    if (managedAdmins !== null) {
      memory.admins = memory.admins.filter((admin) => admin.isOwner).concat(structuredClone(managedAdmins))
    } else {
      for (const admin of memory.admins) {
        admin.analyticsCompanyIds = admin.analyticsCompanyIds.filter((companyId) => activeCompanyIds.has(companyId))
      }
    }
    if (ownerAllowedIpRanges !== null) {
      const owner = memory.admins.find((admin) => admin.isOwner)
      if (owner) owner.allowedIpRanges = normalizeAdminIpRanges(ownerAllowedIpRanges)
    }
    return
  }

  const currentCompanyRows = await sql`SELECT id FROM efukuri_companies`
  const restoredCompanyIds = new Set(companies.map((company) => company.id))

  await sql.transaction((txn) => {
    const queries = contentTypes.flatMap((type) => {
      const json = JSON.stringify(content[type])
      return [
        txn`INSERT INTO efukuri_content_versions (type, items, actor_id) VALUES (${type}, ${json}::jsonb, ${actorId})`,
        txn`INSERT INTO efukuri_content_collections (type, items, updated_at)
          VALUES (${type}, ${json}::jsonb, now())
          ON CONFLICT (type) DO UPDATE SET items = EXCLUDED.items, updated_at = now()`,
      ]
    })

    for (const row of currentCompanyRows) {
      const companyId = String(row.id)
      if (restoredCompanyIds.has(companyId)) {
        queries.push(txn`UPDATE efukuri_companies SET code_digest = ${retiredCompanyDigest()}, updated_at = now()
          WHERE id = ${companyId}::uuid`)
      } else {
        queries.push(txn`DELETE FROM efukuri_admin_company_scopes WHERE company_id = ${companyId}::uuid`)
        queries.push(txn`UPDATE efukuri_companies
          SET code_digest = ${retiredCompanyDigest()}, code_hint = '', active = false,
              session_version = ${randomUUID()}, link_version = ${randomUUID()}, updated_at = now()
          WHERE id = ${companyId}::uuid`)
      }
    }
    for (const company of companies) {
      queries.push(txn`INSERT INTO efukuri_companies
        (id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version, updated_at)
        VALUES (${company.id}, ${company.codeDigest}, ${company.codeHint}, ${company.name}, ${company.pensionName}, ${company.pensionUrl}, ${company.stockPlanName}, ${company.stockPlanUrl}, ${company.fpConsultationUrl}, ${company.logoUrl}, true, ${company.sessionVersion}, ${company.linkVersion}, now())
        ON CONFLICT (id) DO UPDATE SET
          code_digest = EXCLUDED.code_digest, code_hint = EXCLUDED.code_hint, name = EXCLUDED.name,
          pension_name = EXCLUDED.pension_name, pension_url = EXCLUDED.pension_url,
          stock_plan_name = EXCLUDED.stock_plan_name, stock_plan_url = EXCLUDED.stock_plan_url, fp_consultation_url = EXCLUDED.fp_consultation_url,
          logo_url = EXCLUDED.logo_url, active = true, session_version = EXCLUDED.session_version,
          link_version = EXCLUDED.link_version, updated_at = now()`)
    }

    if (managedAdmins !== null) {
      queries.push(txn`DELETE FROM efukuri_admin_users WHERE is_owner = false`)
      for (const admin of managedAdmins) {
        queries.push(txn`INSERT INTO efukuri_admin_users
          (id, password_hash, credential_version, is_owner, permissions, allowed_ip_ranges, updated_at)
          VALUES (${admin.id}, ${admin.passwordHash}, ${admin.credentialVersion}, false, ${JSON.stringify(admin.permissions)}::jsonb, ${JSON.stringify(admin.allowedIpRanges)}::jsonb, now())`)
        for (const companyId of admin.analyticsCompanyIds) {
          queries.push(txn`INSERT INTO efukuri_admin_company_scopes (admin_id, permission, company_id)
            VALUES (${admin.id}, 'analytics', ${companyId}::uuid)`)
        }
      }
    }

    if (ownerAllowedIpRanges !== null) {
      queries.push(txn`UPDATE efukuri_admin_users SET allowed_ip_ranges = ${JSON.stringify(normalizeAdminIpRanges(ownerAllowedIpRanges))}::jsonb, updated_at = now()
        WHERE is_owner = true`)
    }

    const detail = JSON.stringify({
      contentTypes: contentTypes.length,
      companies: companies.length,
      managedAdmins: managedAdmins?.length ?? null,
      ownerIpPolicy: ownerAllowedIpRanges !== null,
    })
    queries.push(txn`INSERT INTO efukuri_audit_log (actor_type, actor_id, action, target_type, target_id, detail)
      VALUES ('admin', ${actorId}, 'backup.restore', 'system', null, ${detail}::jsonb)`)
    return queries
  })
}

export async function getAdminById(id: string): Promise<AdminRecord | null> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) {
    const admin = memory.admins.find((item) => item.id === id)
    return admin ? structuredClone(admin) : null
  }
  const rows = await sql`SELECT admins.id, admins.password_hash, admins.credential_version, admins.is_owner,
      admins.permissions, admins.allowed_ip_ranges,
      COALESCE(
        array_agg(scopes.company_id::text ORDER BY scopes.created_at, scopes.company_id)
          FILTER (WHERE scopes.company_id IS NOT NULL),
        ARRAY[]::text[]
      ) AS analytics_company_ids
    FROM efukuri_admin_users AS admins
    LEFT JOIN efukuri_admin_company_scopes AS scopes
      ON scopes.admin_id = admins.id AND scopes.permission = 'analytics'
    WHERE admins.id = ${id}
    GROUP BY admins.id`
  if (!rows[0]) return null
  return {
    id: String(rows[0].id),
    passwordHash: String(rows[0].password_hash),
    credentialVersion: String(rows[0].credential_version),
    isOwner: Boolean(rows[0].is_owner),
    permissions: normalizePermissions(rows[0].permissions),
    analyticsCompanyIds: Array.isArray(rows[0].analytics_company_ids) ? rows[0].analytics_company_ids.map(String) : [],
    allowedIpRanges: normalizeAdminIpRanges(Array.isArray(rows[0].allowed_ip_ranges) ? rows[0].allowed_ip_ranges.map(String) : []),
  }
}

export async function updateAdminCredentials(currentId: string, nextId: string, passwordHash: string) {
  await ensureSchema()
  const version = new Date().toISOString()
  const sql = getSql()
  if (!sql) {
    const admin = memory.admins.find((item) => item.id === currentId)
    if (!admin) throw new Error('admin-not-found')
    admin.id = nextId
    admin.passwordHash = passwordHash
    admin.credentialVersion = version
    return version
  }
  await sql`UPDATE efukuri_admin_users SET id = ${nextId}, password_hash = ${passwordHash}, credential_version = ${version}, updated_at = now() WHERE id = ${currentId}`
  await writeAudit('admin', currentId, 'admin.credentials.change', 'admin', nextId, {})
  return version
}

export async function listAdmins(): Promise<AdminRecord[]> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.admins)
  const rows = await sql`SELECT id, password_hash, credential_version, is_owner, permissions, allowed_ip_ranges
    FROM efukuri_admin_users ORDER BY is_owner DESC, id ASC`
  const scopeRows = await sql`SELECT admin_id, company_id FROM efukuri_admin_company_scopes
    WHERE permission = 'analytics' ORDER BY created_at, company_id`
  const scopes = new Map<string, string[]>()
  for (const row of scopeRows) {
    const values = scopes.get(String(row.admin_id)) || []
    values.push(String(row.company_id))
    scopes.set(String(row.admin_id), values)
  }
  return rows.map((row) => {
    const id = String(row.id)
    return {
      id,
      passwordHash: String(row.password_hash),
      credentialVersion: String(row.credential_version),
      isOwner: Boolean(row.is_owner),
      permissions: normalizePermissions(row.permissions),
      analyticsCompanyIds: scopes.get(id) || [],
      allowedIpRanges: normalizeAdminIpRanges(Array.isArray(row.allowed_ip_ranges) ? row.allowed_ip_ranges.map(String) : []),
    }
  })
}

export async function createManagedAdmin(
  id: string,
  passwordHash: string,
  permissions: AdminPermission[],
  analyticsCompanyIds: string[],
  allowedIpRanges: string[],
  actorId: string,
) {
  await ensureSchema()
  const version = new Date().toISOString()
  const normalized = normalizePermissions(permissions)
  const normalizedCompanyIds = Array.from(new Set(analyticsCompanyIds))
  const normalizedIpRanges = normalizeAdminIpRanges(allowedIpRanges)
  const sql = getSql()
  if (!sql) {
    if (memory.admins.some((item) => item.id === id)) throw new Error('duplicate-admin-id')
    memory.admins.push({ id, passwordHash, credentialVersion: version, isOwner: false, permissions: normalized, analyticsCompanyIds: normalizedCompanyIds, allowedIpRanges: normalizedIpRanges })
    return
  }
  await sql.transaction((txn) => [
    txn`INSERT INTO efukuri_admin_users (id, password_hash, credential_version, is_owner, permissions, allowed_ip_ranges, updated_at)
      VALUES (${id}, ${passwordHash}, ${version}, false, ${JSON.stringify(normalized)}::jsonb, ${JSON.stringify(normalizedIpRanges)}::jsonb, now())`,
    ...normalizedCompanyIds.map((companyId) => txn`INSERT INTO efukuri_admin_company_scopes (admin_id, permission, company_id)
      VALUES (${id}, 'analytics', ${companyId}::uuid)`),
  ])
  await writeAudit('admin', actorId, 'admin.create', 'admin', id, { permissions: normalized, analyticsCompanyIds: normalizedCompanyIds, allowedIpRanges: normalizedIpRanges })
}

export async function updateManagedAdmin(
  currentId: string,
  nextId: string,
  permissions: AdminPermission[],
  analyticsCompanyIds: string[],
  allowedIpRanges: string[],
  passwordHash: string | null,
  actorId: string,
) {
  await ensureSchema()
  const version = new Date().toISOString()
  const normalized = normalizePermissions(permissions)
  const normalizedCompanyIds = Array.from(new Set(analyticsCompanyIds))
  const normalizedIpRanges = normalizeAdminIpRanges(allowedIpRanges)
  const sql = getSql()
  if (!sql) {
    const admin = memory.admins.find((item) => item.id === currentId && !item.isOwner)
    if (!admin) throw new Error('managed-admin-not-found')
    if (currentId !== nextId && memory.admins.some((item) => item.id === nextId)) throw new Error('duplicate-admin-id')
    admin.id = nextId
    admin.permissions = normalized
    admin.analyticsCompanyIds = normalizedCompanyIds
    admin.allowedIpRanges = normalizedIpRanges
    admin.credentialVersion = version
    if (passwordHash) admin.passwordHash = passwordHash
    return
  }
  const existing = await sql`SELECT id FROM efukuri_admin_users WHERE id = ${currentId} AND is_owner = false`
  if (!existing[0]) throw new Error('managed-admin-not-found')
  await sql.transaction((txn) => [
    txn`DELETE FROM efukuri_admin_company_scopes WHERE admin_id = ${currentId} AND permission = 'analytics'`,
    passwordHash
      ? txn`UPDATE efukuri_admin_users SET id = ${nextId}, password_hash = ${passwordHash}, permissions = ${JSON.stringify(normalized)}::jsonb, allowed_ip_ranges = ${JSON.stringify(normalizedIpRanges)}::jsonb,
          credential_version = ${version}, updated_at = now() WHERE id = ${currentId} AND is_owner = false`
      : txn`UPDATE efukuri_admin_users SET id = ${nextId}, permissions = ${JSON.stringify(normalized)}::jsonb, allowed_ip_ranges = ${JSON.stringify(normalizedIpRanges)}::jsonb,
          credential_version = ${version}, updated_at = now() WHERE id = ${currentId} AND is_owner = false`,
    ...normalizedCompanyIds.map((companyId) => txn`INSERT INTO efukuri_admin_company_scopes (admin_id, permission, company_id)
      VALUES (${nextId}, 'analytics', ${companyId}::uuid)`),
  ])
  await writeAudit('admin', actorId, 'admin.update', 'admin', nextId, {
    previousId: currentId, permissions: normalized, analyticsCompanyIds: normalizedCompanyIds, allowedIpRanges: normalizedIpRanges, passwordChanged: Boolean(passwordHash),
  })
}

export async function updateAdminIpRanges(id: string, allowedIpRanges: string[], actorId: string) {
  await ensureSchema()
  const normalized = normalizeAdminIpRanges(allowedIpRanges)
  const sql = getSql()
  if (!sql) {
    const admin = memory.admins.find((item) => item.id === id)
    if (!admin) throw new Error('admin-not-found')
    admin.allowedIpRanges = normalized
  } else {
    const rows = await sql`UPDATE efukuri_admin_users SET allowed_ip_ranges = ${JSON.stringify(normalized)}::jsonb, updated_at = now()
      WHERE id = ${id} RETURNING id`
    if (!rows[0]) throw new Error('admin-not-found')
  }
  await writeAudit('admin', actorId, 'admin.ip-policy.update', 'admin', id, { allowedIpRanges: normalized })
}

export async function deleteManagedAdmin(id: string, actorId: string) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) {
    const index = memory.admins.findIndex((item) => item.id === id && !item.isOwner)
    if (index === -1) throw new Error('managed-admin-not-found')
    memory.admins.splice(index, 1)
    return
  }
  const result = await sql`DELETE FROM efukuri_admin_users WHERE id = ${id} AND is_owner = false RETURNING id`
  if (!result[0]) throw new Error('managed-admin-not-found')
  await writeAudit('admin', actorId, 'admin.delete', 'admin', id, {})
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.companies.filter((item) => item.active))
  const rows = await sql`SELECT id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version
    FROM efukuri_companies WHERE active = true ORDER BY created_at ASC`
  return rows.map((row) => ({
    id: String(row.id), codeDigest: String(row.code_digest), codeHint: String(row.code_hint), name: String(row.name),
    pensionName: String(row.pension_name), pensionUrl: String(row.pension_url), stockPlanName: String(row.stock_plan_name),
    stockPlanUrl: String(row.stock_plan_url), fpConsultationUrl: String(row.fp_consultation_url || ''), logoUrl: String(row.logo_url || ''), active: Boolean(row.active),
    sessionVersion: String(row.session_version), linkVersion: String(row.link_version),
  }))
}

export async function findCompanyByCode(code: string) {
  const digest = companyCodeDigest(code)
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.companies.find((item) => item.codeDigest === digest && item.active) || null)
  const rows = await sql`SELECT id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version
    FROM efukuri_companies WHERE code_digest = ${digest} AND active = true LIMIT 1`
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id), codeDigest: String(row.code_digest), codeHint: String(row.code_hint), name: String(row.name),
    pensionName: String(row.pension_name), pensionUrl: String(row.pension_url), stockPlanName: String(row.stock_plan_name),
    stockPlanUrl: String(row.stock_plan_url), fpConsultationUrl: String(row.fp_consultation_url || ''), logoUrl: String(row.logo_url || ''), active: Boolean(row.active),
    sessionVersion: String(row.session_version), linkVersion: String(row.link_version),
  }
}

export async function getCompanyById(id: string) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.companies.find((item) => item.id === id && item.active) || null)
  const rows = await sql`SELECT id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version
    FROM efukuri_companies WHERE id = ${id}::uuid AND active = true`
  const row = rows[0]
  if (!row) return null
  return {
    id: String(row.id), codeDigest: String(row.code_digest), codeHint: String(row.code_hint), name: String(row.name),
    pensionName: String(row.pension_name), pensionUrl: String(row.pension_url), stockPlanName: String(row.stock_plan_name),
    stockPlanUrl: String(row.stock_plan_url), fpConsultationUrl: String(row.fp_consultation_url || ''), logoUrl: String(row.logo_url || ''), active: Boolean(row.active),
    sessionVersion: String(row.session_version), linkVersion: String(row.link_version),
  }
}

export type CompanyInput = {
  id?: string
  code?: string
  name: string
  pensionName?: string
  pensionUrl?: string
  stockPlanName?: string
  fpConsultationUrl?: string
  stockPlanUrl?: string
  logoUrl?: string
}

export async function replaceCompanies(inputs: CompanyInput[], actorId: string) {
  await ensureSchema()
  const existing = await listCompanies()
  const existingById = new Map(existing.map((item) => [item.id, item]))
  const records = inputs.map((input) => {
    const previous = input.id ? existingById.get(input.id) : undefined
    if (input.id && !previous) throw new Error('company-not-found')
    const code = input.code?.trim().toLowerCase() || ''
    if (!previous && !code) throw new Error('company-code-required')
    const codeChanged = Boolean(code && !code.startsWith('••••') && companyCodeDigest(code) !== previous?.codeDigest)
    return {
      id: previous?.id || randomUUID(),
      codeDigest: code && !code.startsWith('••••') ? companyCodeDigest(code) : previous!.codeDigest,
      codeHint: code && !code.startsWith('••••') ? code.slice(-4) : previous!.codeHint,
      name: input.name.trim(),
      pensionName: input.pensionName?.trim() || '', pensionUrl: input.pensionUrl?.trim() || '',
      stockPlanName: input.stockPlanName?.trim() || '', stockPlanUrl: input.stockPlanUrl?.trim() || '',
      fpConsultationUrl: input.fpConsultationUrl === undefined ? (previous?.fpConsultationUrl || '') : input.fpConsultationUrl.trim(),
      logoUrl: input.logoUrl?.trim() || '', active: true,
      sessionVersion: codeChanged ? randomUUID() : (previous?.sessionVersion || randomUUID()),
      // Editing company settings never reissues a distributed login link.
      linkVersion: previous?.linkVersion || randomUUID(),
    }
  })
  if (new Set(records.map((item) => item.id)).size !== records.length) throw new Error('duplicate-company-id')
  if (new Set(records.map((item) => item.codeDigest)).size !== records.length) throw new Error('duplicate-company-code')

  const activeCompanyIds = new Set(records.map((record) => record.id))

  const sql = getSql()
  if (!sql) {
    const replacementById = new Map(records.map((record) => [record.id, structuredClone(record)]))
    memory.companies = memory.companies.map((company) => {
      const replacement = replacementById.get(company.id)
      if (replacement) {
        replacementById.delete(company.id)
        return replacement
      }
      if (!company.active) return company
      return {
        ...company,
        codeDigest: retiredCompanyDigest(),
        codeHint: '',
        active: false,
        sessionVersion: randomUUID(),
        linkVersion: randomUUID(),
      }
    }).concat(Array.from(replacementById.values()))
    for (const admin of memory.admins) {
      admin.analyticsCompanyIds = admin.analyticsCompanyIds.filter((companyId) => activeCompanyIds.has(companyId))
    }
    return
  }
  const currentCompanyRows = await sql`SELECT id FROM efukuri_companies`
  await sql.transaction((txn) => {
    const queries = []
    for (const row of currentCompanyRows) {
      const companyId = String(row.id)
      if (activeCompanyIds.has(companyId)) {
        queries.push(txn`UPDATE efukuri_companies SET code_digest = ${retiredCompanyDigest()}, updated_at = now()
          WHERE id = ${companyId}::uuid`)
      } else {
        queries.push(txn`DELETE FROM efukuri_admin_company_scopes WHERE company_id = ${companyId}::uuid`)
        queries.push(txn`UPDATE efukuri_companies
          SET code_digest = ${retiredCompanyDigest()}, code_hint = '', active = false,
              session_version = ${randomUUID()}, link_version = ${randomUUID()}, updated_at = now()
          WHERE id = ${companyId}::uuid`)
      }
    }
    for (const record of records) {
      queries.push(txn`INSERT INTO efukuri_companies
        (id, code_digest, code_hint, name, pension_name, pension_url, stock_plan_name, stock_plan_url, fp_consultation_url, logo_url, active, session_version, link_version, updated_at)
        VALUES (${record.id}, ${record.codeDigest}, ${record.codeHint}, ${record.name}, ${record.pensionName}, ${record.pensionUrl}, ${record.stockPlanName}, ${record.stockPlanUrl}, ${record.fpConsultationUrl}, ${record.logoUrl}, true, ${record.sessionVersion}, ${record.linkVersion}, now())
        ON CONFLICT (id) DO UPDATE SET
          code_digest = EXCLUDED.code_digest, code_hint = EXCLUDED.code_hint, name = EXCLUDED.name,
          pension_name = EXCLUDED.pension_name, pension_url = EXCLUDED.pension_url,
          stock_plan_name = EXCLUDED.stock_plan_name, stock_plan_url = EXCLUDED.stock_plan_url, fp_consultation_url = EXCLUDED.fp_consultation_url,
          logo_url = EXCLUDED.logo_url, active = true, session_version = EXCLUDED.session_version,
          link_version = efukuri_companies.link_version, updated_at = now()`)
    }
    const detail = JSON.stringify({ count: records.length, deactivated: existing.filter((company) => !activeCompanyIds.has(company.id)).length })
    queries.push(txn`INSERT INTO efukuri_audit_log (actor_type, actor_id, action, target_type, target_id, detail)
      VALUES ('admin', ${actorId}, 'companies.save', 'company', null, ${detail}::jsonb)`)
    return queries
  })
}

export async function rotateCompanyLinkVersion(id: string, actorId: string) {
  await ensureSchema()
  const version = randomUUID()
  const sql = getSql()
  if (!sql) {
    const company = memory.companies.find((item) => item.id === id && item.active)
    if (!company) throw new Error('company-not-found')
    company.linkVersion = version
    return structuredClone(company)
  }
  await sql.transaction((txn) => [
    txn`UPDATE efukuri_companies SET link_version = ${version}, updated_at = now() WHERE id = ${id}::uuid AND active = true`,
    txn`INSERT INTO efukuri_audit_log (actor_type, actor_id, action, target_type, target_id, detail)
      VALUES ('admin', ${actorId}, 'company.link.rotate', 'company', ${id}, '{}'::jsonb)`,
  ])
  const company = await getCompanyById(id)
  if (!company) throw new Error('company-not-found')
  return company
}

export async function writeAudit(actorType: string, actorId: string, action: string, targetType: string, targetId: string | null, detail: Record<string, unknown>) {
  const sql = getSql()
  if (!sql) {
    memory.auditLog.push({
      id: memory.nextAuditId++, actorType, actorId, action, targetType, targetId,
      detail: structuredClone(detail), createdAt: new Date().toISOString(),
    })
    if (actorType === 'admin' && (adminAccessActions as readonly string[]).includes(action)) {
      const cutoff = Date.now() - 365 * 86_400_000
      memory.auditLog = memory.auditLog.filter((item) => new Date(item.createdAt).getTime() >= cutoff)
    }
    return
  }
  const json = JSON.stringify(detail)
  await sql`INSERT INTO efukuri_audit_log (actor_type, actor_id, action, target_type, target_id, detail)
    VALUES (${actorType}, ${actorId}, ${action}, ${targetType}, ${targetId}, ${json}::jsonb)`
  if (actorType === 'admin' && (adminAccessActions as readonly string[]).includes(action)) {
    await sql`DELETE FROM efukuri_audit_log
      WHERE actor_type = 'admin'
        AND action IN ('admin.login', 'admin.login.success', 'admin.login.failure', 'admin.login.blocked', 'admin.login.ip-denied', 'admin.logout', 'admin.page.view')
        AND created_at < now() - interval '365 days'`
  }
}

function adminAccessDetail(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {}
  }
  return {} as Record<string, unknown>
}

export async function listAdminAccessLogs(input: {
  from: string
  to: string
  adminId: string
  action: '' | AdminAccessAction
  limit: number
  offset: number
}) {
  await ensureSchema()
  const sql = getSql()
  const allowedActions = adminAccessActions as readonly string[]
  if (!sql) {
    const fromTime = new Date(`${input.from}T00:00:00+09:00`).getTime()
    const toTime = new Date(`${input.to}T23:59:59.999+09:00`).getTime()
    const filtered = memory.auditLog.filter((item) => {
      const time = new Date(item.createdAt).getTime()
      return item.actorType === 'admin' && allowedActions.includes(item.action)
        && time >= fromTime && time <= toTime
        && (!input.adminId || item.actorId === input.adminId)
        && (!input.action || item.action === input.action || (input.action === 'admin.login.success' && item.action === 'admin.login'))
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    return {
      total: filtered.length,
      logs: filtered.slice(input.offset, input.offset + input.limit).map((item) => {
        const detail = adminAccessDetail(item.detail)
        return {
          id: String(item.id), occurredAt: item.createdAt, adminId: item.actorId,
          action: item.action as AdminAccessAction, path: String(detail.path || ''),
          ipAddress: String(detail.ipAddress || ''), userAgent: String(detail.userAgent || ''),
        }
      }),
    }
  }

  const rows = await sql`SELECT id::text, actor_id, action, detail, created_at
    FROM efukuri_audit_log
    WHERE actor_type = 'admin'
      AND action IN ('admin.login', 'admin.login.success', 'admin.login.failure', 'admin.login.blocked', 'admin.login.ip-denied', 'admin.logout', 'admin.page.view')
      AND created_at >= (${input.from}::date::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND created_at < ((${input.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND (${input.adminId} = '' OR actor_id = ${input.adminId})
      AND (${input.action} = '' OR action = ${input.action} OR (${input.action} = 'admin.login.success' AND action = 'admin.login'))
    ORDER BY created_at DESC, id DESC
    LIMIT ${input.limit} OFFSET ${input.offset}`
  const totals = await sql`SELECT count(*)::int AS count
    FROM efukuri_audit_log
    WHERE actor_type = 'admin'
      AND action IN ('admin.login', 'admin.login.success', 'admin.login.failure', 'admin.login.blocked', 'admin.login.ip-denied', 'admin.logout', 'admin.page.view')
      AND created_at >= (${input.from}::date::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND created_at < ((${input.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Tokyo')
      AND (${input.adminId} = '' OR actor_id = ${input.adminId})
      AND (${input.action} = '' OR action = ${input.action} OR (${input.action} = 'admin.login.success' AND action = 'admin.login'))`
  return {
    total: Number(totals[0]?.count || 0),
    logs: rows.map((row) => {
      const detail = adminAccessDetail(row.detail)
      return {
        id: String(row.id), occurredAt: new Date(String(row.created_at)).toISOString(), adminId: String(row.actor_id),
        action: String(row.action) as AdminAccessAction, path: String(detail.path || ''),
        ipAddress: String(detail.ipAddress || ''), userAgent: String(detail.userAgent || ''),
      }
    }),
  }
}

export async function consumeLoginAttempt(key: string, limit = 10, windowMinutes = 15) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) {
    const now = Date.now()
    const previous = memory.loginAttempts.get(key)
    const current = !previous || now - previous.startedAt > windowMinutes * 60_000
      ? { count: 1, startedAt: now }
      : { count: previous.count + 1, startedAt: previous.startedAt }
    memory.loginAttempts.set(key, current)
    return current.count <= limit
  }
  const rows = await sql`INSERT INTO efukuri_login_attempts (key, attempts, window_started_at)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN efukuri_login_attempts.window_started_at < now() - (${windowMinutes} * interval '1 minute') THEN 1 ELSE efukuri_login_attempts.attempts + 1 END,
      window_started_at = CASE WHEN efukuri_login_attempts.window_started_at < now() - (${windowMinutes} * interval '1 minute') THEN now() ELSE efukuri_login_attempts.window_started_at END
    RETURNING attempts`
  return Number(rows[0]?.attempts || 1) <= limit
}

export async function clearLoginAttempts(key: string) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) { memory.loginAttempts.delete(key); return }
  await sql`DELETE FROM efukuri_login_attempts WHERE key = ${key}`
}

function jstDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date)
}

export async function recordPageView(companyId: string, path: string, sessionDigest: string, label = '') {
  await ensureSchema()
  const eventDate = jstDate()
  const sql = getSql()
  if (!sql) {
    for (const trackedPath of [path, '@session']) {
      const key = `${companyId}:${eventDate}:${trackedPath}:${sessionDigest}`
      const isUnique = !memory.analyticsUnique.has(key)
      memory.analyticsUnique.add(key)
      let row = memory.analyticsDaily.find((item) => item.companyId === companyId && item.eventDate === eventDate && item.path === trackedPath)
      if (!row) {
        row = { companyId, eventDate, path: trackedPath, label: trackedPath === path ? label : '', pageViews: 0, uniqueSessions: 0 }
        memory.analyticsDaily.push(row)
      }
      if (trackedPath === path && label) row.label = label
      if (trackedPath !== '@session') row.pageViews += 1
      if (isUnique) row.uniqueSessions += 1
    }
    return memory.analyticsDaily.find((item) => item.companyId === companyId && item.eventDate === eventDate && item.path === path)?.pageViews || 0
  }

  const pageUnique = await sql`INSERT INTO efukuri_analytics_unique_daily (company_id, event_date, path, session_digest)
    VALUES (${companyId}::uuid, ${eventDate}::date, ${path}, ${sessionDigest})
    ON CONFLICT DO NOTHING RETURNING 1`
  const pageRows = await sql`INSERT INTO efukuri_analytics_daily
      (company_id, event_date, path, label, page_views, unique_sessions, updated_at)
    VALUES (${companyId}::uuid, ${eventDate}::date, ${path}, ${label}, 1, ${pageUnique.length ? 1 : 0}, now())
    ON CONFLICT (company_id, event_date, path) DO UPDATE SET
      label = CASE WHEN EXCLUDED.label <> '' THEN EXCLUDED.label ELSE efukuri_analytics_daily.label END,
      page_views = efukuri_analytics_daily.page_views + 1,
      unique_sessions = efukuri_analytics_daily.unique_sessions + EXCLUDED.unique_sessions,
      updated_at = now()
    RETURNING page_views`

  const sessionUnique = await sql`INSERT INTO efukuri_analytics_unique_daily (company_id, event_date, path, session_digest)
    VALUES (${companyId}::uuid, ${eventDate}::date, '@session', ${sessionDigest})
    ON CONFLICT DO NOTHING RETURNING 1`
  await sql`INSERT INTO efukuri_analytics_daily
      (company_id, event_date, path, page_views, unique_sessions, updated_at)
    VALUES (${companyId}::uuid, ${eventDate}::date, '@session', 0, ${sessionUnique.length ? 1 : 0}, now())
    ON CONFLICT (company_id, event_date, path) DO UPDATE SET
      unique_sessions = efukuri_analytics_daily.unique_sessions + EXCLUDED.unique_sessions,
      updated_at = now()`

  try {
    await sql`DELETE FROM efukuri_analytics_unique_daily WHERE event_date < (current_date - 90)`
  } catch (error) {
    console.warn('[analytics.retention] cleanup failed', { error: error instanceof Error ? error.message : String(error) })
  }
  return Number(pageRows[0]?.page_views || 0)
}

export async function recordLinkClick(companyId: string, sourcePath: string, targetUrl: string, linkLabel: string, sessionDigest: string) {
  const eventPath = `@click:${createHash('sha256').update(`${sourcePath}\n${targetUrl}`).digest('hex').slice(0, 40)}`
  const cleanLabel = linkLabel.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) || 'リンク'
  const sourceLabel = memberAnalyticsLabels[sourcePath] || sourcePath
  return recordPageView(companyId, eventPath, sessionDigest, `${sourceLabel}：${cleanLabel}`)
}

export async function listAnalyticsDaily(): Promise<AnalyticsDailyRecord[]> {
  await ensureSchema()
  const sql = getSql()
  if (!sql) return structuredClone(memory.analyticsDaily)
  const rows = await sql`SELECT company_id, event_date::text, path, label, page_views, unique_sessions
    FROM efukuri_analytics_daily ORDER BY event_date, company_id, path`
  return rows.map((row) => ({
    companyId: String(row.company_id), eventDate: String(row.event_date), path: String(row.path), label: String(row.label || ''),
    pageViews: Number(row.page_views), uniqueSessions: Number(row.unique_sessions),
  }))
}

export async function restoreAnalyticsDaily(records: AnalyticsDailyRecord[]) {
  await ensureSchema()
  const sql = getSql()
  if (!sql) {
    memory.analyticsDaily = structuredClone(records)
    memory.analyticsUnique.clear()
    return
  }
  await sql.transaction((txn) => {
    const queries = [txn`DELETE FROM efukuri_analytics_unique_daily`, txn`DELETE FROM efukuri_analytics_daily`]
    for (const record of records) {
      queries.push(txn`INSERT INTO efukuri_analytics_daily
        (company_id, event_date, path, label, page_views, unique_sessions, updated_at)
        VALUES (${record.companyId}::uuid, ${record.eventDate}::date, ${record.path}, ${record.label || ''}, ${record.pageViews}, ${record.uniqueSessions}, now())`)
    }
    return queries
  })
}

function dateSequence(from: string, to: string) {
  const result: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    result.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

export async function getAnalyticsReport(from: string, to: string, selectedCompanyId: string | null): Promise<AnalyticsReport> {
  await ensureSchema()
  const companies = await listCompanies()
  const companyIds = new Set(companies.map((company) => company.id))
  if (selectedCompanyId && !companyIds.has(selectedCompanyId)) throw new Error('company-not-found')
  const sql = getSql()
  let loginRows: Array<Record<string, unknown>> = []
  let pageRows: Array<Record<string, unknown>> = []
  if (sql) {
    loginRows = await sql`SELECT actor_id AS company_id,
        (created_at AT TIME ZONE 'Asia/Tokyo')::date::text AS event_date,
        action, count(*)::int AS event_count
      FROM efukuri_audit_log
      WHERE actor_type = 'member' AND action IN ('member.login', 'member.link-login')
        AND created_at >= (${from}::date::timestamp AT TIME ZONE 'Asia/Tokyo')
        AND created_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Asia/Tokyo')
        AND (${selectedCompanyId}::text IS NULL OR actor_id = ${selectedCompanyId})
      GROUP BY actor_id, event_date, action`
    pageRows = await sql`SELECT company_id::text, event_date::text, path, label, page_views, unique_sessions
      FROM efukuri_analytics_daily
      WHERE event_date BETWEEN ${from}::date AND ${to}::date
        AND (${selectedCompanyId}::uuid IS NULL OR company_id = ${selectedCompanyId}::uuid)`
  } else {
    pageRows = memory.analyticsDaily
      .filter((row) => row.eventDate >= from && row.eventDate <= to && (!selectedCompanyId || row.companyId === selectedCompanyId))
      .map((row) => ({ company_id: row.companyId, event_date: row.eventDate, path: row.path, label: row.label, page_views: row.pageViews, unique_sessions: row.uniqueSessions }))
  }

  const idsInReport = selectedCompanyId ? [selectedCompanyId] : companies.map((company) => company.id)
  const companyName = new Map(companies.map((company) => [company.id, company.name]))
  const selectedCompany = selectedCompanyId ? companies.find((company) => company.id === selectedCompanyId) : null
  function analyticsLabel(path: string, storedLabel: string) {
    if (storedLabel) return storedLabel
    if (path === '@link:pension' && selectedCompany?.pensionName) return `確定拠出年金リンク：${selectedCompany.pensionName}`
    if (path === '@link:stock-plan' && selectedCompany?.stockPlanName) return `持株会リンク：${selectedCompany.stockPlanName}`
    return memberAnalyticsLabels[path] || path
  }
  const perCompany = new Map(idsInReport.map((id) => [id, {
    companyId: id, companyName: companyName.get(id) || '不明な企業', logins: 0, codeLogins: 0,
    linkLogins: 0, pageViews: 0, uniqueSessions: 0,
  }]))
  const dailyMap = new Map(dateSequence(from, to).map((date) => [date, { date, logins: 0, pageViews: 0, uniqueSessions: 0 }]))
  const pageMap = new Map<string, { path: string; label: string; pageViews: number; uniqueSessions: number }>()

  function isNavigationClick(path: string, label: string) {
    if (!path.startsWith('@click:')) return false
    const value = label.replace(/[←→↑↓]/g, '').replace(/\s+/g, '')
    return /(ホーム|会員ホーム|トップ|管理メニュー|専門家選択)(画面)?(に|へ)?戻る/.test(value)
      || /(前のページ|一覧)(に|へ)?戻る/.test(value)
      || /本文へ移動/.test(value)
  }

  function isExcludedPageView(path: string) {
    return path === '/embed-service.html' || path === '/embed-service.htm'
  }

  for (const row of loginRows) {
    const id = String(row.company_id)
    const count = Number(row.event_count || 0)
    const target = perCompany.get(id)
    if (!target) continue
    target.logins += count
    if (row.action === 'member.link-login') target.linkLogins += count
    else target.codeLogins += count
    const day = dailyMap.get(String(row.event_date))
    if (day) day.logins += count
  }
  for (const row of pageRows) {
    const id = String(row.company_id)
    const path = String(row.path)
    const storedLabel = String(row.label || '')
    if (isNavigationClick(path, storedLabel) || isExcludedPageView(path)) continue
    const views = Number(row.page_views || 0)
    const unique = Number(row.unique_sessions || 0)
    const target = perCompany.get(id)
    if (!target) continue
    const day = dailyMap.get(String(row.event_date))
    if (path === '@session') {
      target.uniqueSessions += unique
      if (day) day.uniqueSessions += unique
      continue
    }
    target.pageViews += views
    if (day) day.pageViews += views
    const page = pageMap.get(path) || { path, label: analyticsLabel(path, storedLabel), pageViews: 0, uniqueSessions: 0 }
    page.pageViews += views
    page.uniqueSessions += unique
    pageMap.set(path, page)
  }

  const companyRows = Array.from(perCompany.values()).sort((a, b) => b.pageViews - a.pageViews || b.logins - a.logins || a.companyName.localeCompare(b.companyName, 'ja'))
  const summary = companyRows.reduce((sum, row) => ({
    logins: sum.logins + row.logins,
    codeLogins: sum.codeLogins + row.codeLogins,
    linkLogins: sum.linkLogins + row.linkLogins,
    pageViews: sum.pageViews + row.pageViews,
    uniqueSessions: sum.uniqueSessions + row.uniqueSessions,
  }), { logins: 0, codeLogins: 0, linkLogins: 0, pageViews: 0, uniqueSessions: 0 })

  console.info('[analytics.report] generated', {
    from, to, selectedCompany: Boolean(selectedCompanyId), rawPageRows: pageRows.length,
    logins: summary.logins, pageViews: summary.pageViews, uniqueSessions: summary.uniqueSessions,
  })

  return {
    range: { from, to }, selectedCompanyId,
    companies: companies.map((company) => ({ id: company.id, name: company.name })),
    summary,
    daily: Array.from(dailyMap.values()),
    pages: Array.from(pageMap.values()).sort((a, b) => b.pageViews - a.pageViews || a.label.localeCompare(b.label, 'ja')),
    companyRows,
  }
}
