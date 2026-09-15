import type { ContentType } from '@/lib/defaults'

export const adminPermissions = [
  'companies',
  'notice',
  'seminar',
  'topic',
  'consultation',
  'expert',
  'video',
  'service',
  'mainvisual',
  'menu',
  'analytics',
] as const

export type AdminPermission = typeof adminPermissions[number]

export const contentPermission: Partial<Record<ContentType, AdminPermission>> = {
  hero: 'mainvisual',
  menu: 'menu',
  notice: 'notice',
  seminar: 'seminar',
  video: 'video',
  service: 'service',
  expert: 'expert',
  consultation: 'consultation',
  topic: 'topic',
}

export const sectionPermission: Record<string, AdminPermission> = {
  topics: 'topic',
  consultations: 'consultation',
  videos: 'video',
  services: 'service',
}

export const adminPagePermission: Record<string, AdminPermission | 'owner'> = {
  '/admin-companies.html': 'companies',
  '/admin-notices.html': 'notice',
  '/admin-seminars.html': 'seminar',
  '/admin-topics.html': 'topic',
  '/admin-consultations.html': 'consultation',
  '/admin-experts.html': 'expert',
  '/admin-videos.html': 'video',
  '/admin-services.html': 'service',
  '/admin-mainvisual.html': 'mainvisual',
  '/admin-menu.html': 'menu',
  '/admin-settings.html': 'owner',
  '/admin-access-logs.html': 'owner',
  '/admin-analytics.html': 'analytics',
}

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && (adminPermissions as readonly string[]).includes(value)
}

export function normalizePermissions(values: unknown): AdminPermission[] {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values.filter(isAdminPermission)))
}

export function hasPermission(admin: { isOwner: boolean; permissions: AdminPermission[] }, permission: AdminPermission) {
  return admin.isOwner || admin.permissions.includes(permission)
}
