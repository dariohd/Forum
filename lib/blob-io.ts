import { get, put } from '@vercel/blob'
import { assertStorageConfigured } from './mode.js'

const STATE_PATH = 'mur-libre/site-state.json'

type RateEvent = { key: string; createdAt: string }

export type StateUser = {
  id: string
  username: string
  passwordHash: string
  displayName: string
  bio: string
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
  createdAt: string
  updatedAt: string
}

export type StateReply = {
  id: string
  threadId: string
  authorId: string
  content: string
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
  users: StateUser[]
  sessions: StateSession[]
  forums: StateForum[]
  threads: StateThread[]
  replies: StateReply[]
  pages: StatePage[]
  strokes: StateStroke[]
  texts: StateText[]
  images: StateImage[]
  rateEvents: RateEvent[]
}

function defaultState(): SiteState {
  const now = new Date().toISOString()
  return {
    users: [],
    sessions: [],
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
    rateEvents: [],
  }
}

async function loadState(): Promise<SiteState> {
  assertStorageConfigured()
  try {
    const file = await get(STATE_PATH, { access: 'private' })
    if (file?.statusCode === 200 && file.stream) {
      const text = await new Response(file.stream).text()
      const parsed = JSON.parse(text) as Partial<SiteState>
      if (parsed && Array.isArray(parsed.forums)) {
        return {
          ...defaultState(),
          ...parsed,
          users: parsed.users ?? [],
          sessions: parsed.sessions ?? [],
          threads: parsed.threads ?? [],
          replies: parsed.replies ?? [],
          strokes: parsed.strokes ?? [],
          texts: parsed.texts ?? [],
          images: parsed.images ?? [],
          rateEvents: parsed.rateEvents ?? [],
        }
      }
    }
  } catch {
    /* premier chargement ou blob absent */
  }
  return defaultState()
}

async function saveState(state: SiteState): Promise<void> {
  assertStorageConfigured()
  await put(STATE_PATH, JSON.stringify(state), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  })
}

export async function withState<T>(fn: (state: SiteState) => T | Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    const state = await loadState()
    try {
      const result = await fn(state)
      await saveState(state)
      return result
    } catch (e) {
      lastError = e
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Échec écriture état')
}

export async function readState<T>(fn: (state: SiteState) => T): Promise<T> {
  const state = await loadState()
  return fn(state)
}

export async function pruneRateEvents(state: SiteState, windowSec: number) {
  const cutoff = Date.now() - windowSec * 1000
  state.rateEvents = state.rateEvents.filter((e) => new Date(e.createdAt).getTime() >= cutoff)
}

export function findUser(state: SiteState, id: string): StateUser | undefined {
  return state.users.find((u) => u.id === id)
}

export function publicUser(u: StateUser) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    createdAt: u.createdAt,
  }
}
