import * as blob from './blob-store'
import { useBlobStorage } from './mode'
import { ensureSchema, sql } from './sql'

const BLOB_HOST = '.public.blob.vercel-storage.com'
const AUTHOR_RE = /^[\p{L}\p{N}\s._-]{0,30}$/u
const COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  if (Array.isArray(forwarded) && forwarded[0]) return forwarded[0].split(',')[0].trim()
  const real = req.headers['x-real-ip']
  if (typeof real === 'string') return real
  return 'unknown'
}

export function sanitizeAuthor(raw: unknown): string {
  const s = String(raw ?? '').trim().slice(0, 30)
  if (!s) return 'Anonyme'
  return AUTHOR_RE.test(s) ? s : 'Anonyme'
}

export function sanitizeColor(raw: unknown, fallback = '#e8e6f0'): string {
  const s = String(raw ?? '').trim()
  return COLOR_RE.test(s) ? s : fallback
}

export function sanitizeText(raw: unknown, max = 5000): string {
  return String(raw ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim()
    .slice(0, max)
}

export function clamp01(n: unknown): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}

export function isValidBlobUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith(BLOB_HOST)
  } catch {
    return false
  }
}

export async function checkRateLimit(key: string, max: number, windowSec: number): Promise<void> {
  if (useBlobStorage()) return blob.blobCheckRateLimit(key, max, windowSec)

  await ensureSchema()
  const db = sql()
  const windowStart = new Date(Date.now() - windowSec * 1000).toISOString()

  await db`DELETE FROM rate_events WHERE created_at < ${windowStart}`

  const rows = await db`
    SELECT COUNT(*)::int AS count FROM rate_events
    WHERE rate_key = ${key} AND created_at >= ${windowStart}
  ` as { count: number }[]

  if ((rows[0]?.count ?? 0) >= max) {
    throw new Error('Trop de requêtes. Réessaie dans un instant.')
  }

  await db`INSERT INTO rate_events (rate_key) VALUES (${key})`
}

export function validatePoints(points: unknown): { x: number; y: number }[] {
  if (!Array.isArray(points)) throw new Error('Trait invalide')
  if (points.length < 2) throw new Error('Trait trop court')
  if (points.length > 800) throw new Error('Trait trop long')

  return points.map((p) => {
    if (!p || typeof p !== 'object') throw new Error('Point invalide')
    const pt = p as { x?: unknown; y?: unknown }
    return { x: clamp01(pt.x), y: clamp01(pt.y) }
  })
}
