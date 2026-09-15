export class ConfigurationError extends Error {}

export function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function authSecret() {
  const value = process.env.AUTH_SECRET?.trim()
  if (value && value.length >= 32) return value
  if (!isProduction()) return 'efukuri-local-development-secret-change-before-production'
  throw new ConfigurationError('AUTH_SECRET is not configured')
}

export function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || ''
}

export function initialAdmin() {
  const id = process.env.INITIAL_ADMIN_ID?.trim() || ''
  const password = process.env.INITIAL_ADMIN_PASSWORD || ''
  return { id, password }
}

export type InitialCompany = {
  code: string
  name: string
  pensionName?: string
  pensionUrl?: string
  stockPlanName?: string
  stockPlanUrl?: string
  fpConsultationUrl?: string
}

export function configuredCompanies(): InitialCompany[] {
  const raw = process.env.INITIAL_COMPANIES_JSON?.trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is InitialCompany => Boolean(item && item.code && item.name))
  } catch {
    throw new ConfigurationError('INITIAL_COMPANIES_JSON is not valid JSON')
  }
}
