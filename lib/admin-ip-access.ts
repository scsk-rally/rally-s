import { verifyAdminIpProof } from '@/lib/security'

type ParsedIp = { version: 4 | 6; bits: 32 | 128; bytes: number[] }

function parseIpv4(value: string): ParsedIp | null {
  const parts = value.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null
  const numbers = parts.map(Number)
  if (numbers.some((part) => part < 0 || part > 255)) return null
  return { version: 4, bits: 32, bytes: numbers }
}

function parseIpv6(value: string): ParsedIp | null {
  let input = value.toLowerCase().split('%')[0]
  if (!input || input.includes(':::') || input.indexOf('::') !== input.lastIndexOf('::')) return null
  if (input.includes('.')) {
    const separator = input.lastIndexOf(':')
    const ipv4 = separator >= 0 ? parseIpv4(input.slice(separator + 1)) : null
    if (!ipv4) return null
    input = `${input.slice(0, separator)}:${((ipv4.bytes[0] << 8) | ipv4.bytes[1]).toString(16)}:${((ipv4.bytes[2] << 8) | ipv4.bytes[3]).toString(16)}`
  }
  const compressed = input.includes('::')
  const [leftRaw, rightRaw = ''] = input.split('::')
  const left = leftRaw ? leftRaw.split(':') : []
  const right = rightRaw ? rightRaw.split(':') : []
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null
  if ((!compressed && left.length !== 8) || (compressed && left.length + right.length >= 8)) return null
  const groups = compressed ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left
  if (groups.length !== 8) return null
  return {
    version: 6,
    bits: 128,
    bytes: groups.flatMap((part) => {
      const value = Number.parseInt(part, 16)
      return [value >> 8, value & 0xff]
    }),
  }
}

function stripPort(value: string) {
  const trimmed = value.trim()
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(trimmed)
  if (bracketed) return bracketed[1]
  return /^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed) ? trimmed.slice(0, trimmed.lastIndexOf(':')) : trimmed
}

function parseIp(value: string): ParsedIp | null {
  let normalized = stripPort(value)
  if (normalized.toLowerCase().startsWith('::ffff:')) normalized = normalized.slice(7)
  return parseIpv4(normalized) || parseIpv6(normalized)
}

function parseRange(value: string) {
  const parts = value.trim().toLowerCase().split('/')
  if (parts.length > 2 || !parts[0]) return null
  const ip = parseIp(parts[0])
  if (!ip) return null
  const prefix = parts.length === 1 ? ip.bits : Number(parts[1])
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > ip.bits || (parts.length === 2 && !/^\d{1,3}$/.test(parts[1]))) return null
  return { ...ip, prefix }
}

export function normalizeAdminIpRanges(values: string[]) {
  const normalized = values.map((value) => value.trim().toLowerCase()).filter(Boolean)
  if (normalized.length > 50) throw new Error('too-many-ip-ranges')
  if (normalized.some((value) => !parseRange(value))) throw new Error('invalid-ip-range')
  return Array.from(new Set(normalized))
}

export function adminClientIp(headers: Pick<Headers, 'get'>) {
  const forwarded = (headers.get('x-vercel-forwarded-for') || headers.get('x-forwarded-for'))?.split(',')[0]?.trim()
  const candidate = forwarded || headers.get('x-real-ip')?.trim() || ''
  return parseIp(candidate) ? stripPort(candidate).replace(/^::ffff:/i, '') : ''
}

export function adminRequestIp(headers: Pick<Headers, 'get'>, adminId: string) {
  const forwardedIp = headers.get('x-efukuri-admin-client-ip')?.trim() || ''
  const proof = headers.get('x-efukuri-admin-ip-proof')?.trim() || ''
  if (forwardedIp && proof && verifyAdminIpProof(forwardedIp, adminId, proof) && parseIp(forwardedIp)) {
    return stripPort(forwardedIp).replace(/^::ffff:/i, '')
  }
  return adminClientIp(headers)
}

export function isAdminIpAllowed(clientIp: string, allowedRanges: string[]) {
  if (!allowedRanges.length) return true
  const client = parseIp(clientIp)
  if (!client) return false
  return allowedRanges.some((value) => {
    const range = parseRange(value)
    if (!range || range.version !== client.version) return false
    const fullBytes = Math.floor(range.prefix / 8)
    for (let index = 0; index < fullBytes; index += 1) {
      if (client.bytes[index] !== range.bytes[index]) return false
    }
    const remainingBits = range.prefix % 8
    if (!remainingBits) return true
    const mask = (0xff << (8 - remainingBits)) & 0xff
    return (client.bytes[fullBytes] & mask) === (range.bytes[fullBytes] & mask)
  })
}

export function isAdminRequestAllowed(admin: { id: string; allowedIpRanges: string[] }, headers: Pick<Headers, 'get'>) {
  return isAdminIpAllowed(adminRequestIp(headers, admin.id), admin.allowedIpRanges)
}
