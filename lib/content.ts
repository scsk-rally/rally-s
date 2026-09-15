import { contentLimits, contentTypes, type ContentItem, type ContentType } from '@/lib/defaults'

function parseJstDate(value: unknown) {
  if (!value) return null
  const raw = String(value)
  const withZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw) ? `${raw}+09:00` : raw
  const time = new Date(withZone).getTime()
  return Number.isFinite(time) ? time : null
}

export function isPublished(item: ContentItem, now = Date.now()) {
  if (item.visible !== true) return false
  const start = parseJstDate(item.startAt)
  const end = parseJstDate(item.endAt)
  if (start !== null && now < start) return false
  if (end !== null && now > end) return false
  return true
}

export function publishedCollections(collections: Record<ContentType, ContentItem[]>) {
  const result = {} as Record<ContentType, ContentItem[]>
  for (const type of contentTypes) {
    result[type] = type === 'hero' || type === 'menu' || type === 'section'
      ? collections[type]
      : collections[type].filter((item) => isPublished(item))
  }
  return result
}

function isSafeUrl(value: unknown, allowHash = false) {
  const url = String(value || '').trim()
  if (!url) return false
  if (allowHash && /^#[A-Za-z][\w:-]*$/.test(url)) return true
  if (/^https:\/\//i.test(url)) return true
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || /^\/\//.test(url)) return false
  return /(?:^|\/)[^?#]+\.html?(?:[?#].*)?$/i.test(url)
}

export function validateContent(type: ContentType, input: unknown): ContentItem[] {
  if (!Array.isArray(input)) throw new Error('invalid-content')
  if (input.length > contentLimits[type]) throw new Error('content-limit')
  const items = structuredClone(input) as ContentItem[]
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id) throw new Error('invalid-content-item')
    if (type !== 'hero' && type !== 'menu' && typeof item.title !== 'string') throw new Error('title-required')
    if (item.startAt && item.endAt) {
      const start = parseJstDate(item.startAt)
      const end = parseJstDate(item.endAt)
      if (start === null || end === null || end <= start) throw new Error('invalid-schedule')
    }
    if (type === 'notice' && Array.from(String(item.body || '')).length > 50) throw new Error('notice-too-long')
    if (type === 'video' && !String(item.youtubeId || '')) throw new Error('youtube-id-required')
    if (['service', 'expert', 'consultation'].includes(type) && !isSafeUrl(item.targetUrl)) throw new Error('invalid-target-url')
    if (type === 'topic' && !isSafeUrl(item.targetUrl, true)) throw new Error('invalid-target-url')
    if (type === 'section' && item.linkUrl && !isSafeUrl(item.linkUrl, true)) throw new Error('invalid-link-url')
  }
  return items
}
