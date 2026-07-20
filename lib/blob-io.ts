import { BlobPreconditionFailedError, get, put } from '@vercel/blob'
import { assertStorageConfigured } from './mode.js'

const STATE_PATH = 'mur-libre/site-state.json'

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN
}

export type StateUser = {
  id: string
  username: string
  passwordHash: string
  displayName: string
  bio: string
  role: 'user' | 'moderator' | 'admin'
  createdAt: string
}

export type StateSession = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: string
}

export type StateForum = {
  id: string
  slug: string
  name: string
  description: string
  sortOrder: number
  createdAt: string
}

export type StateThread = {
  id: string
  forumId: string
  authorId: string
  title: string
  hiddenAt: string | null
  hiddenBy: string | null
  hiddenReason: string | null
  createdAt: string
  updatedAt: string
}

export type StateReply = {
  id: string
  threadId: string
  authorId: string
  content: string
  hiddenAt: string | null
  hiddenBy: string | null
  hiddenReason: string | null
  createdAt: string
}

export type StatePage = {
  id: string
  slug: string
  title: string
  content: string
  authorId: string | null
  published: boolean
  createdAt: string
  updatedAt: string
}

export type StateStroke = {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
  author: string
  createdAt: string
}

export type StateText = {
  id: string
  x: number
  y: number
  content: string
  author: string
  color: string
  fontSize: number
  createdAt: string
}

export type StateImage = {
  id: string
  x: number
  y: number
  width: number
  height: number
  url: string
  author: string
  createdAt: string
}

export type SiteState = {
  forums: StateForum[]
  threads: StateThread[]
  replies: StateReply[]
  pages: StatePage[]
  strokes: StateStroke[]
  texts: StateText[]
  images: StateImage[]
}

function defaultState(): SiteState {
  const now = new Date().toISOString()
  return {
    forums: [
      { id: 'f-general', slug: 'general', name: 'Général', description: 'Discussions libres et présentations.', sortOrder: 0, createdAt: now },
      { id: 'f-creations', slug: 'creations', name: 'Créations', description: 'Dessins, projets et idées du mur.', sortOrder: 1, createdAt: now },
      { id: 'f-aide', slug: 'aide', name: 'Aide', description: 'Questions sur le site et la communauté.', sortOrder: 2, createdAt: now },
    ],
    threads: [],
    replies: [],
    pages: [
      {
        id: 'p-bienvenue',
        slug: 'bienvenue',
        title: 'Bienvenue',
        content: `Le Mur libre est la page d'accueil : un espace ouvert pour dessiner et écrire ensemble.

Les forums permettent des discussions structurées par thème. Crée un compte pour ouvrir des sujets et répondre.

Les pages regroupent les contenus permanents du site.`,
        authorId: null,
        published: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    strokes: [],
    texts: [],
    images: [],
  }
}

function normalizeThread(t: Partial<StateThread>): StateThread {
  return {
    id: t.id!,
    forumId: t.forumId!,
    authorId: t.authorId!,
    title: t.title!,
    hiddenAt: t.hiddenAt ?? null,
    hiddenBy: t.hiddenBy ?? null,
    hiddenReason: t.hiddenReason ?? null,
    createdAt: t.createdAt!,
    updatedAt: t.updatedAt!,
  }
}

function normalizeReply(r: Partial<StateReply>): StateReply {
  return {
    id: r.id!,
    threadId: r.threadId!,
    authorId: r.authorId!,
    content: r.content!,
    hiddenAt: r.hiddenAt ?? null,
    hiddenBy: r.hiddenBy ?? null,
    hiddenReason: r.hiddenReason ?? null,
    createdAt: r.createdAt!,
  }
}

function parseState(text: string): SiteState {
  const parsed = JSON.parse(text) as Partial<SiteState> & { users?: unknown; sessions?: unknown; rateEvents?: unknown }
  if (parsed && Array.isArray(parsed.forums)) {
    return {
      ...defaultState(),
      ...parsed,
      threads: (parsed.threads ?? []).map(normalizeThread),
      replies: (parsed.replies ?? []).map(normalizeReply),
      strokes: parsed.strokes ?? [],
      texts: parsed.texts ?? [],
      images: parsed.images ?? [],
    }
  }
  return defaultState()
}

async function loadState(): Promise<{ state: SiteState; etag?: string }> {
  assertStorageConfigured()
  try {
    const file = await get(STATE_PATH, { access: 'private', token: blobToken() })
    if (file?.statusCode === 200 && file.stream) {
      const text = await new Response(file.stream).text()
      return { state: parseState(text), etag: file.blob.etag }
    }
  } catch (e) {
    console.error('[blob-io] loadState failed:', e)
  }
  return { state: defaultState() }
}

async function saveState(state: SiteState, etag?: string): Promise<void> {
  assertStorageConfigured()
  await put(STATE_PATH, JSON.stringify(state), {
    access: 'private',
    token: blobToken(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    ...(etag ? { ifMatch: etag } : {}),
  })
}

function isPreconditionError(e: unknown): boolean {
  return e instanceof BlobPreconditionFailedError
    || (e instanceof Error && /precondition|etag mismatch/i.test(e.message))
}

export async function withState<T>(fn: (state: SiteState) => T | Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 12; attempt++) {
    const { state, etag } = await loadState()
    try {
      const result = await fn(state)
      try {
        await saveState(state, etag)
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
  throw lastError instanceof Error ? lastError : new Error('Échec écriture état')
}

export async function readState<T>(fn: (state: SiteState) => T): Promise<T> {
  const { state } = await loadState()
  return fn(state)
}
