import { randomUUID, randomBytes } from 'crypto'
import * as blob from './blob-store.js'
import { hashPassword, validateUsername, verifyPassword, hashToken } from './auth-core.js'
import { useBlobStorage, assertAuthDatabase } from './mode.js'
import { ensureSchema, sql } from './sql.js'
import type { PublicUser } from './types.js'

const SESSION_DAYS = 30

export { validateUsername, hashPassword, verifyPassword } from './auth-core.js'

export async function registerUser(input: {
  username: string
  password: string
  displayName: string
}): Promise<{ user: PublicUser; token: string }> {
  assertAuthDatabase()
  if (useBlobStorage()) return blob.blobRegisterUser(input)

  await ensureSchema()
  const db = sql()
  const username = validateUsername(input.username)
  if (!username) throw new Error('Pseudo invalide (3–24 caractères, lettres, chiffres, _).')
  if (input.password.length < 8) throw new Error('Mot de passe trop court (8 caractères min).')

  const displayName = input.displayName.trim().slice(0, 40) || username
  const passwordHash = await hashPassword(input.password)
  const id = randomUUID()

  const [{ c: existingUsers }] = await db`SELECT COUNT(*)::int AS c FROM users` as { c: number }[]
  const role = existingUsers === 0 ? 'admin' : 'user'

  try {
    await db`INSERT INTO users (id, username, password_hash, display_name, role) VALUES (${id}, ${username}, ${passwordHash}, ${displayName}, ${role})`
  } catch {
    throw new Error('Ce pseudo est déjà pris.')
  }

  const token = await createSession(id)
  return { user: { id, username, displayName, bio: '', role, createdAt: new Date().toISOString() }, token }
}

export async function loginUser(username: string, password: string): Promise<{ user: PublicUser; token: string }> {
  assertAuthDatabase()
  if (useBlobStorage()) return blob.blobLoginUser(username, password)

  await ensureSchema()
  const db = sql()
  const name = validateUsername(username)
  if (!name) throw new Error('Identifiants incorrects.')

  const rows = await db`
    SELECT id, username, password_hash, display_name, bio, role, created_at
    FROM users WHERE username = ${name}
  ` as { id: string; username: string; password_hash: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string }[]

  const row = rows[0]
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    throw new Error('Identifiants incorrects.')
  }

  const token = await createSession(row.id)
  return {
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
    },
    token,
  }
}

export async function createSession(userId: string): Promise<string> {
  assertAuthDatabase()
  if (useBlobStorage()) return blob.blobCreateSession(userId)

  await ensureSchema()
  const db = sql()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()
  await db`INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (${randomUUID()}, ${userId}, ${hashToken(token)}, ${expiresAt})`
  return token
}

export async function getUserByToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null
  if (process.env.VERCEL && !process.env.DATABASE_URL) return null
  if (useBlobStorage()) return blob.blobGetUserByToken(token)
  await ensureSchema()
  const db = sql()
  const rows = await db`
    SELECT u.id, u.username, u.display_name, u.bio, u.role, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()
  ` as { id: string; username: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string }[]

  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function logoutToken(token: string | undefined): Promise<void> {
  if (!token) return
  if (process.env.VERCEL && !process.env.DATABASE_URL) return
  if (useBlobStorage()) return blob.blobLogoutToken(token)
  await ensureSchema()
  const db = sql()
  await db`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`
}

export async function requireUser(token: string | undefined): Promise<PublicUser> {
  const user = await getUserByToken(token)
  if (!user) throw new Error('Connexion requise.')
  return user
}

export function isModerator(user: PublicUser): boolean {
  return user.role === 'moderator' || user.role === 'admin'
}

export async function requireModerator(token: string | undefined): Promise<PublicUser> {
  const user = await requireUser(token)
  if (!isModerator(user)) throw new Error('Action réservée aux modérateurs.')
  return user
}
