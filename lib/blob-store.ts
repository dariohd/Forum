import { randomUUID } from 'crypto'
import { createHash, randomBytes } from 'crypto'
import { hashPassword, verifyPassword, validateUsername } from './auth-core.js'
import {
  findUser,
  publicUser,
  readAuthState,
  withAuthState,
  type AuthState,
} from './blob-auth-io.js'
import {
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
  PageInfo,
  PublicUser,
  Reply,
  SitePage,
  Stroke,
  TextItem,
  ThreadDetail,
  ThreadSummary,
  UserProfile,
} from './types.js'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function paginate<T>(items: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): { items: T[]; page: PageInfo } {
  const size = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE_SIZE))
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), totalPages)
  const start = (current - 1) * size
  return { items: items.slice(start, start + size), page: { page: current, pageSize: size, total, totalPages } }
}

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

function authorPublic(auth: AuthState, authorId: string): PublicUser {
  const user = findUser(auth, authorId)
  if (user) return publicUser(user)
  return { id: authorId, username: 'inconnu', displayName: 'Utilisateur', bio: '', role: 'user', createdAt: new Date(0).toISOString() }
}

function threadSummary(state: SiteState, auth: AuthState, t: StateThread): ThreadSummary {
  return {
    id: t.id,
    forumId: t.forumId,
    title: t.title,
    author: authorPublic(auth, t.authorId),
    replyCount: state.replies.filter((r) => r.threadId === t.id && !r.hiddenAt).length,
    hidden: !!t.hiddenAt,
    hiddenReason: t.hiddenReason,
    hiddenBy: t.hiddenBy,
    hiddenAt: t.hiddenAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

function mapReply(auth: AuthState, r: StateReply): Reply {
  return {
    id: r.id,
    threadId: r.threadId,
    content: r.content,
    author: authorPublic(auth, r.authorId),
    hidden: !!r.hiddenAt,
    hiddenReason: r.hiddenReason,
    hiddenBy: r.hiddenBy,
    hiddenAt: r.hiddenAt,
    createdAt: r.createdAt,
  }
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
  const [site, auth] = await Promise.all([
    readState((state) => ({
      strokes: state.strokes.length,
      texts: state.texts.length,
      images: state.images.length,
    })),
    readAuthState((auth) => ({
      users: auth.users.length,
      sessions: auth.sessions.length,
    })),
  ])
  return { ...site, ...auth }
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
  let role: 'user' | 'moderator' | 'admin' = 'user'

  await withAuthState((state) => {
    if (state.users.some((u) => u.username === username)) throw new Error('Ce pseudo est déjà pris.')
    role = state.users.length === 0 ? 'admin' : 'user'
    state.users.push({ id, username, passwordHash, displayName, bio: '', role, createdAt })
    state.sessions.push({ id: randomUUID(), userId: id, tokenHash, expiresAt })
  })

  return { user: { id, username, displayName, bio: '', role, createdAt }, token }
}

export async function blobLoginUser(username: string, password: string): Promise<{ user: PublicUser; token: string }> {
  const name = validateUsername(username)
  if (!name) throw new Error('Identifiants incorrects.')

  const user = await readAuthState((state) => state.users.find((u) => u.username === name))
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error('Identifiants incorrects.')
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()

  await withAuthState((state) => {
    state.sessions.push({ id: randomUUID(), userId: user.id, tokenHash, expiresAt })
  })

  return { user: publicUser(user), token }
}

export async function blobCreateSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString()

  await withAuthState((state) => {
    state.sessions.push({ id: randomUUID(), userId, tokenHash, expiresAt })
  })
  return token
}

export async function blobGetUserByToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null
  const tokenHash = hashToken(token)
  const now = Date.now()

  return readAuthState((state) => {
    const session = state.sessions.find((s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now)
    if (!session) return null
    const user = findUser(state, session.userId)
    return user ? publicUser(user) : null
  })
}

export async function blobLogoutToken(token: string | undefined): Promise<void> {
  if (!token) return
  const tokenHash = hashToken(token)
  await withAuthState((state) => {
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
        threadCount: state.threads.filter((t) => t.forumId === f.id && !t.hiddenAt).length,
        createdAt: f.createdAt,
      })),
  )
}

export async function blobGetForumBySlug(
  slug: string,
  opts: { page?: number; pageSize?: number; includeHidden?: boolean } = {},
) {
  const auth = await readAuthState((a) => a)
  return readState((state) => {
    const f = state.forums.find((x) => x.slug === slug)
    if (!f) return null
    const visibleThreads = state.threads
      .filter((t) => t.forumId === f.id && (opts.includeHidden || !t.hiddenAt))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    const { items, page } = paginate(visibleThreads, opts.page, opts.pageSize)

    return {
      forum: {
        id: f.id,
        slug: f.slug,
        name: f.name,
        description: f.description,
        threadCount: state.threads.filter((t) => t.forumId === f.id && !t.hiddenAt).length,
        createdAt: f.createdAt,
      },
      threads: items.map((t) => threadSummary(state, auth, t)),
      page,
    }
  })
}

export async function blobCreateThread(forumSlug: string, authorId: string, title: string): Promise<ThreadSummary> {
  const cleanTitle = sanitizeText(title, 120)
  if (!cleanTitle) throw new Error('Titre vide.')

  const now = new Date().toISOString()
  const thread: StateThread = {
    id: randomUUID(),
    forumId: '',
    authorId,
    title: cleanTitle,
    hiddenAt: null,
    hiddenBy: null,
    hiddenReason: null,
    createdAt: now,
    updatedAt: now,
  }

  await withState((state) => {
    const forum = state.forums.find((f) => f.slug === forumSlug)
    if (!forum) throw new Error('Forum introuvable.')
    thread.forumId = forum.id
    state.threads.push(thread)
  })

  const [state, auth] = await Promise.all([
    readState((s) => s),
    readAuthState((a) => a),
  ])
  return threadSummary(state, auth, thread)
}

export async function blobGetThread(
  id: string,
  opts: { page?: number; pageSize?: number; includeHidden?: boolean } = {},
): Promise<ThreadDetail | null> {
  const [state, auth] = await Promise.all([
    readState((s) => s),
    readAuthState((a) => a),
  ])
  const t = state.threads.find((x) => x.id === id)
  if (!t) return null
  if (t.hiddenAt && !opts.includeHidden) return null
  const forum = state.forums.find((f) => f.id === t.forumId)!
  const visibleReplies = state.replies
    .filter((r) => r.threadId === id && (opts.includeHidden || !r.hiddenAt))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const { items, page } = paginate(visibleReplies, opts.page, opts.pageSize)

  return {
    id: t.id,
    title: t.title,
    forum: { id: forum.id, slug: forum.slug, name: forum.name },
    author: authorPublic(auth, t.authorId),
    replies: items.map((r) => mapReply(auth, r)),
    repliesPage: page,
    hidden: !!t.hiddenAt,
    hiddenReason: t.hiddenReason,
    hiddenBy: t.hiddenBy,
    hiddenAt: t.hiddenAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

export async function blobAddReply(threadId: string, authorId: string, content: string): Promise<Reply> {
  const clean = sanitizeText(content, 5000)
  if (!clean) throw new Error('Message vide.')

  const reply: StateReply = {
    id: randomUUID(),
    threadId,
    authorId,
    content: clean,
    hiddenAt: null,
    hiddenBy: null,
    hiddenReason: null,
    createdAt: new Date().toISOString(),
  }

  await withState((state) => {
    if (!state.threads.some((t) => t.id === threadId)) throw new Error('Sujet introuvable.')
    state.replies.push(reply)
    const thread = state.threads.find((t) => t.id === threadId)!
    thread.updatedAt = reply.createdAt
  })

  const auth = await readAuthState((a) => a)
  return mapReply(auth, reply)
}

export async function blobModerateThread(
  threadId: string,
  moderatorId: string,
  hidden: boolean,
  reason?: string,
): Promise<void> {
  await withState((state) => {
    const t = state.threads.find((x) => x.id === threadId)
    if (!t) throw new Error('Sujet introuvable.')
    t.hiddenAt = hidden ? new Date().toISOString() : null
    t.hiddenBy = hidden ? moderatorId : null
    t.hiddenReason = hidden ? (reason?.trim().slice(0, 200) || null) : null
  })
}

export async function blobModerateReply(
  threadId: string,
  replyId: string,
  moderatorId: string,
  hidden: boolean,
  reason?: string,
): Promise<void> {
  await withState((state) => {
    const r = state.replies.find((x) => x.id === replyId && x.threadId === threadId)
    if (!r) throw new Error('Réponse introuvable.')
    r.hiddenAt = hidden ? new Date().toISOString() : null
    r.hiddenBy = hidden ? moderatorId : null
    r.hiddenReason = hidden ? (reason?.trim().slice(0, 200) || null) : null
  })
}

export async function blobDeleteThread(threadId: string): Promise<void> {
  await withState((state) => {
    if (!state.threads.some((t) => t.id === threadId)) throw new Error('Sujet introuvable.')
    state.threads = state.threads.filter((t) => t.id !== threadId)
    state.replies = state.replies.filter((r) => r.threadId !== threadId)
  })
}

export async function blobDeleteReply(threadId: string, replyId: string): Promise<void> {
  await withState((state) => {
    if (!state.replies.some((r) => r.id === replyId && r.threadId === threadId)) throw new Error('Réponse introuvable.')
    state.replies = state.replies.filter((r) => r.id !== replyId)
  })
}

export async function blobListPages(): Promise<SitePage[]> {
  const auth = await readAuthState((a) => a)
  return readState((state) =>
    state.pages
      .filter((p) => p.published)
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        content: p.content,
        author: p.authorId ? authorPublic(auth, p.authorId) : null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
  )
}

export async function blobGetPageBySlug(slug: string): Promise<SitePage | null> {
  const auth = await readAuthState((a) => a)
  return readState((state) => {
    const p = state.pages.find((x) => x.slug === slug && x.published)
    if (!p) return null
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      content: p.content,
      author: p.authorId ? authorPublic(auth, p.authorId) : null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  })
}

export async function blobGetUserProfile(username: string): Promise<UserProfile | null> {
  const [state, auth] = await Promise.all([
    readState((s) => s),
    readAuthState((a) => a),
  ])
  const u = auth.users.find((x) => x.username === username.toLowerCase())
  if (!u) return null
  return {
    ...publicUser(u),
    threadCount: state.threads.filter((t) => t.authorId === u.id).length,
    replyCount: state.replies.filter((r) => r.authorId === u.id).length,
  }
}
