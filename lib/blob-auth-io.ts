import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { assertStorageConfigured } from './mode.js'
import type { StateSession, StateUser } from './blob-io.js'

const AUTH_PATH = 'mur-libre/auth-state.json'

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN
}

export type AuthState = {
  users: StateUser[]
  sessions: StateSession[]
}

function defaultAuthState(): AuthState {
  return { users: [], sessions: [] }
}

async function loadAuth(): Promise<{ state: AuthState; etag?: string }> {
  assertStorageConfigured()
  try {
    const file = await get(AUTH_PATH, { access: 'private', token: blobToken() })
    if (file?.statusCode === 200 && file.stream) {
      const parsed = JSON.parse(await new Response(file.stream).text()) as Partial<AuthState>
      return {
        state: {
          users: (parsed.users ?? []).map((u) => ({ ...u, role: u.role ?? 'user' })),
          sessions: parsed.sessions ?? [],
        },
        etag: file.blob.etag,
      }
    }
  } catch {
    /* premier chargement */
  }
  return { state: defaultAuthState() }
}

async function saveAuth(state: AuthState, etag?: string): Promise<void> {
  const opts = {
    access: 'private' as const,
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  }
  try {
    await put(AUTH_PATH, JSON.stringify(state), { ...opts, ...(etag ? { ifMatch: etag } : {}) })
  } catch (e) {
    if (!isPreconditionError(e)) throw e
    await put(AUTH_PATH, JSON.stringify(state), opts)
  }
}

function isPreconditionError(e: unknown): boolean {
  return e instanceof BlobPreconditionFailedError
    || (e instanceof Error && /precondition|etag mismatch/i.test(e.message))
}

export async function withAuthState<T>(fn: (state: AuthState) => T | Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, etag } = await loadAuth()
    try {
      const result = await fn(state)
      try {
        await saveAuth(state, etag)
      } catch (e) {
        if (isPreconditionError(e) && attempt < 11) {
          await new Promise((r) => setTimeout(r, 25 * (attempt + 1)))
          continue
        }
        throw e
      }
      return result
    } catch (e) {
      if (e instanceof Error && /Trop de|déjà pris|invalide|incorrects|requis|vide/i.test(e.message)) {
        throw e
      }
      lastError = e
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Échec écriture auth')
}

export async function readAuthState<T>(fn: (state: AuthState) => T): Promise<T> {
  const { state } = await loadAuth()
  return fn(state)
}

export function findUser(state: AuthState, id: string): StateUser | undefined {
  return state.users.find((u) => u.id === id)
}

export function publicUser(u: StateUser) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    role: u.role,
    createdAt: u.createdAt,
  }
}
