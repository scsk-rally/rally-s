import defaultData from '@/data/default-data.json'

export type ContentType = keyof typeof defaultData.content
export type ContentItem = Record<string, unknown> & { id: string }

export const contentLimits: Record<ContentType, number> = {
  hero: 1,
  menu: 1,
  section: 4,
  notice: 3,
  seminar: 5,
  video: 5,
  service: 6,
  expert: 6,
  consultation: 3,
  topic: 4,
}

export const contentTypes = Object.keys(contentLimits) as ContentType[]

export const defaultContent = structuredClone(defaultData.content) as Record<ContentType, ContentItem[]>
export const developmentCompanies = structuredClone(defaultData.companies)

export function isContentType(value: string): value is ContentType {
  return Object.prototype.hasOwnProperty.call(contentLimits, value)
}

export function cloneDefaultContent(): Record<ContentType, ContentItem[]> {
  return structuredClone(defaultContent)
}
