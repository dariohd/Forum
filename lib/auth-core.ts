import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)
const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/

export function validateUsername(username: string): string | null {
  const s = username.trim().toLowerCase()
  if (!USERNAME_RE.test(s)) return null
  return s
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== derived.length) return false
  return timingSafeEqual(new Uint8Array(derived), new Uint8Array(expected))
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
