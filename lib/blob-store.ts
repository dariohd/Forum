import { randomUUID } from 'crypto'
import { createHash, randomBytes } from 'crypto'
import { hashPassword, verifyPassword, validateUsername } from './auth-core.js'
import {
  findUser,
  pruneRateEvents,
  publicUser,
  readState,
  withState,
  type SiteState,
  type StateImage,
  type StateReply,
  type StateStroke,
  type StateText,
  type StateThread,
} from './blob-io.js'
import { sanitizeText } from './security.js'
import type {
  BoardSnapshot,
  CanvasImage,
  Forum,
  PublicUser,
  Reply,
  SitePage,
  Stroke,
  TextItem,
  ThreadDetail,
  ThreadSummary,
  UserProfile,
} from './types.js'

const SESSION_DAYS = 30

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function mapStroke(s: StateStroke): Stroke {
  return { id: s.id, points: s.points, color: s.color, width: s.width, tool: s.tool, author: s.author, createdAt: s.createdAt }
}

function mapText(t: StateText): TextItem {
  return { id: t.id, x: t.x, y: t.y, content: t.content, author: t.author, color: t.color, fontSize: t.fontSize, createdAt: t.createdAt }
}

function mapImage(i: StateImage): CanvasImage {
  return { id: i.id, x: i.x, y: i.y, width: i.width, height: i.height, url: i.url, author: i.author, createdAt: i.createdAt }
}

function threadSummary(state: SiteState, t: StateThread): ThreadSummary {
  const author = findUser(state, t.authorId)!
  return {
    id: t.id,
    forumId: t.forumId,
    title: t.title,
    author: publicUser(author),
    replyCount: state.replies.filter((r) => r.threadId === t.id).length,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function mapReply(state: SiteState, r: StateReply): Reply {
  const author = findUser(state, r.authorId)!
  return {
    id: r.id,
    threadId: r.threadId,
    content: r.content,
    author: publicUser(author),
    createdAt: r.createdAt,
  }
}

export async function blobCheckRateLimit(key: string, max: number, windowSec: number): Promise<void> {
  await withState((state) => {
    pruneRateEvents(state, windowSec)
    const count = state.rateEvents.filter((e) => e.key === key).length
    if (count >= max) throw new Error('Trop de requêtes. Réessaie dans un instant.')
    state.rateEvents.push({ key, createdAt: new Date().toISOString() })
  })
}

export async function blobGetBoard(since?: string): Promise<BoardSnapshot> {
  return readState((state) => {
    const sinceTime = since ? new Date(since).getTime() : 0
    const after = (d: string) => !sinceTime || new Date(d).getTime() > sinceTime

    return {
      strokes: state.strokes.filter((s) => after(s.createdAt)).map(mapStroke),
      texts: state.texts.filter((t) => after(t.createdAt)).map(mapText),
      images: state.images.filter((i) => after(i.createdAt)).map(mapImage),
      serverTime: new Date().toISOString(),
    }
  })
}

export async function blobGetStats() {
  return readState((state) => ({
    strokes: state.strokes.length,
    texts: state.texts.length,
    images: state.images.length,
    users: state.users.length,
    sessions: state.sessions.length,
  }))
}

export async function blobAddStroke(input: Omit<Stroke, 'id' | 'createdAt'>): Promise<Stroke> {
  const stroke: StateStroke = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
  await withState((state) => { state.strokes.push(stroke) })
  return mapStroke(stroke)
}

export async function blobAddText(input: Omit<TextItem, 'id' | 'createdAt'>): Promise<TextItem> {
  const text: StateText = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
  await withState((state) => { state.texts.push(text) })
  return mapText(text)
}

export async function blobAddImage(input: Omit<CanvasImage, 'id' | 'createdAt'>): Promise<CanvasImage> {
  const image: StateImage = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }
  await withState((state) => { state.images.push(image) })
  return mapImage(image)
}

export async function blobRegisterUser(input: {
  username: string
  password: string
  displayName: string
}): Promise<{ user: PublicUser; token: string }> {
  const username = validateUsername(input.username)
  if (!username) throw new Error('Pseudo invalide (3–24 caractères, lettres, chiffres, _).')
  if (input.password.length < 8) throw new Error('Mot de passe trop court (8 caractères min).')

  const displayName = input.displayName.trim().slice(0, 40) || username
  const passwordHash = await hashPassword(input.password)
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()

  await withState((state) => {
    if (state.users.some((u) => u.username === username)) throw new Error('Ce pseudo est déjà pris.')
    state.users.push({ id, username, passwordHash, displayName, bio: '', createdAt })
    state.sessions.push({ id: randomUUID(), userId: id, tokenHash, expiresAt })
  })

  return { user: { id, username, displayName, bio: '', createdAt }, token }
}

export async function blobLoginUser(username: string, password: string): Promise<{ user: PublicUser; token: string }> {
  const name = validateUsername(username)
  if (!name) throw new Error('Identifiants incorrects.')

  const user = await readState((state) => state.users.find((u) => u.username === name))
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error('Identifiants incorrects.')
  }

  const token = await blobCreateSession(user.id)
  return { user: publicUser(user), token }
}

export async function blobCreateSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()

  await withState((state) => {
    state.sessions.push({ id: randomUUID(), userId, tokenHash, expiresAt })
  })
  return token
}

export async function blobGetUserByToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null
  const tokenHash = hashToken(token)
  const now = Date.now()

  return readState((state) => {
    const session = state.sessions.find((s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now)
    if (!session) return null
    const user = findUser(state, session.userId)
    return user ? publicUser(user) : null
  })
}

export async function blobLogoutToken(token: string | undefined): Promise<void> {
  if (!token) return
  const tokenHash = hashToken(token)
  await withState((state) => {
    state.sessions = state.sessions.filter((s) => s.tokenHash !== tokenHash)
  })
}

export async function blobListForums(): Promise<Forum[]> {
  return readState((state) =>
    [...state.forums]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        description: f.description,
        threadCount: state.threads.filter((t) => t.forumId === f.id).length,
        createdAt: f.createdAt,
      })),
  )
}

export async function blobGetForumBySlug(slug: string) {
  return readState((state) => {
    const f = state.forums.find((x) => x.slug === slug)
    if (!f) return null
    const threads = state.threads
      .filter((t) => t.forumId === f.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((t) => threadSummary(state, t))

    return {
      forum: {
        id: f.id,
        slug: f.slug,
        name: f.name,
        description: f.description,
        threadCount: threads.length,
        createdAt: f.createdAt,
      },
      threads,
    }
  })
}

export async function blobCreateThread(forumSlug: string, authorId: string, title: string): Promise<ThreadSummary> {
  const cleanTitle = sanitizeText(title, 120)
  if (!cleanTitle) throw new Error('Titre vide.')

  const now = new Date().toISOString()
  const thread: StateThread = { id: randomUUID(), forumId: '', authorId, title: cleanTitle, createdAt: now, updatedAt: now }

  await withState((state) => {
    const forum = state.forums.find((f) => f.slug === forumSlug)
    if (!forum) throw new Error('Forum introuvable.')
    thread.forumId = forum.id
    state.threads.push(thread)
  })

  return readState((state) => threadSummary(state, thread))
}

export async function blobGetThread(id: string): Promise<ThreadDetail | null> {
  return readState((state) => {
    const t = state.threads.find((x) => x.id === id)
    if (!t) return null
    const forum = state.forums.find((f) => f.id === t.forumId)!
    const author = findUser(state, t.authorId)!
    const replies = state.replies
      .filter((r) => r.threadId === id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map((r) => mapReply(state, r))

    return {
      id: t.id,
      title: t.title,
      forum: { id: forum.id, slug: forum.slug, name: forum.name },
      author: publicUser(author),
      replies,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }
  })
}

export async function blobAddReply(threadId: string, authorId: string, content: string): Promise<Reply> {
  const clean = sanitizeText(content, 5000)
  if (!clean) throw new Error('Message vide.')

  const reply: StateReply = { id: randomUUID(), threadId, authorId, content: clean, createdAt: new Date().toISOString() }

  await withState((state) => {
    if (!state.threads.some((t) => t.id === threadId)) throw new Error('Sujet introuvable.')
    state.replies.push(reply)
    const thread = state.threads.find((t) => t.id === threadId)!
    thread.updatedAt = reply.createdAt
  })

  return readState((state) => mapReply(state, reply))
}

export async function blobListPages(): Promise<SitePage[]> {
  return readState((state) =>
    state.pages
      .filter((p) => p.published)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        author: p.authorId ? publicUser(findUser(state, p.authorId)!) : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
  )
}

export async function blobGetPageBySlug(slug: string): Promise<SitePage | null> {
  return readState((state) => {
    const p = state.pages.find((x) => x.slug === slug && x.published)
    if (!p) return null
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      author: p.authorId ? publicUser(findUser(state, p.authorId)!) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  })
}

export async function blobGetUserProfile(username: string): Promise<UserProfile | null> {
  return readState((state) => {
    const u = state.users.find((x) => x.username === username.toLowerCase())
    if (!u) return null
    return {
      ...publicUser(u),
      threadCount: state.threads.filter((t) => t.authorId === u.id).length,
      replyCount: state.replies.filter((r) => r.authorId === u.id).length,
    }
  })
}
