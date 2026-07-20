import { randomUUID } from 'crypto'
import * as blob from './blob-store.js'
import { useBlobStorage } from './mode.js'
import { ensureSchema, sql } from './sql.js'
import { sanitizeText } from './security.js'
import type { Forum, PageInfo, PublicUser, Reply, SitePage, ThreadDetail, ThreadSummary, UserProfile } from './types.js'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

function parsePage(page?: number, pageSize?: number) {
  const p = Math.max(1, Math.trunc(page ?? 1) || 1)
  const ps = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))
  return { page: p, pageSize: ps, offset: (p - 1) * ps }
}

function buildPageInfo(page: number, pageSize: number, total: number): PageInfo {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
}

function isoOrNull(value: string | null): string | null {
  return value ? new Date(value).toISOString() : null
}

function mapUser(row: { id: string; username: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string }): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function listForums(): Promise<Forum[]> {
  if (useBlobStorage()) return blob.blobListForums()
  const db = sql()
  const rows = await db`
    SELECT f.id, f.slug, f.name, f.description, f.created_at,
           COUNT(t.id) FILTER (WHERE t.hidden_at IS NULL)::int AS thread_count
    FROM forums f
    LEFT JOIN threads t ON t.forum_id = f.id
    GROUP BY f.id
    ORDER BY f.sort_order ASC, f.name ASC
  ` as { id: string; slug: string; name: string; description: string; created_at: string; thread_count: number }[]

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    threadCount: r.thread_count,
    createdAt: new Date(r.created_at).toISOString(),
  }))
}

export async function getForumBySlug(
  slug: string,
  opts: { page?: number; pageSize?: number; includeHidden?: boolean } = {},
): Promise<{ forum: Forum; threads: ThreadSummary[]; page: PageInfo } | null> {
  if (useBlobStorage()) return blob.blobGetForumBySlug(slug, opts)

  await ensureSchema()
  const db = sql()
  const { page, pageSize, offset } = parsePage(opts.page, opts.pageSize)
  const includeHidden = !!opts.includeHidden

  const forums = await db`
    SELECT id, slug, name, description, created_at FROM forums WHERE slug = ${slug}
  ` as { id: string; slug: string; name: string; description: string; created_at: string }[]

  const f = forums[0]
  if (!f) return null

  const visibleCountRows = await db`
    SELECT COUNT(*)::int AS c FROM threads WHERE forum_id = ${f.id} AND hidden_at IS NULL
  ` as { c: number }[]

  const totalRows = includeHidden
    ? await db`SELECT COUNT(*)::int AS c FROM threads WHERE forum_id = ${f.id}` as { c: number }[]
    : visibleCountRows

  type ThreadRow = {
    id: string; forum_id: string; title: string; created_at: string; updated_at: string
    hidden_at: string | null; hidden_by: string | null; hidden_reason: string | null
    author_id: string; username: string; display_name: string; bio: string; author_role: PublicUser['role']; author_created: string
    reply_count: number
  }

  const threads = includeHidden
    ? await db`
        SELECT t.id, t.forum_id, t.title, t.hidden_at, t.hidden_by, t.hidden_reason, t.created_at, t.updated_at,
               u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created,
               COUNT(r.id) FILTER (WHERE r.hidden_at IS NULL)::int AS reply_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
        LEFT JOIN replies r ON r.thread_id = t.id
        WHERE t.forum_id = ${f.id}
        GROUP BY t.id, u.id
        ORDER BY t.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      ` as ThreadRow[]
    : await db`
        SELECT t.id, t.forum_id, t.title, t.hidden_at, t.hidden_by, t.hidden_reason, t.created_at, t.updated_at,
               u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created,
               COUNT(r.id) FILTER (WHERE r.hidden_at IS NULL)::int AS reply_count
        FROM threads t
        JOIN users u ON u.id = t.author_id
        LEFT JOIN replies r ON r.thread_id = t.id
        WHERE t.forum_id = ${f.id} AND t.hidden_at IS NULL
        GROUP BY t.id, u.id
        ORDER BY t.updated_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      ` as ThreadRow[]

  return {
    forum: {
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description,
      threadCount: visibleCountRows[0]?.c ?? 0,
      createdAt: new Date(f.created_at).toISOString(),
    },
    threads: threads.map((t) => ({
      id: t.id,
      forumId: t.forum_id,
      title: t.title,
      author: mapUser({ id: t.author_id, username: t.username, display_name: t.display_name, bio: t.bio, role: t.author_role, created_at: t.author_created }),
      replyCount: t.reply_count,
      hidden: !!t.hidden_at,
      hiddenReason: t.hidden_reason,
      hiddenBy: t.hidden_by,
      hiddenAt: isoOrNull(t.hidden_at),
      createdAt: new Date(t.created_at).toISOString(),
      updatedAt: new Date(t.updated_at).toISOString(),
    })),
    page: buildPageInfo(page, pageSize, totalRows[0]?.c ?? 0),
  }
}

export async function createThread(forumSlug: string, authorId: string, title: string): Promise<ThreadSummary> {
  if (useBlobStorage()) return blob.blobCreateThread(forumSlug, authorId, title)

  await ensureSchema()
  const db = sql()

  const cleanTitle = sanitizeText(title).slice(0, 120)
  if (!cleanTitle) throw new Error('Titre vide.')

  const forums = await db`SELECT id FROM forums WHERE slug = ${forumSlug}` as { id: string }[]
  const forum = forums[0]
  if (!forum) throw new Error('Forum introuvable.')

  const id = randomUUID()
  await db`
    INSERT INTO threads (id, forum_id, author_id, title)
    VALUES (${id}, ${forum.id}, ${authorId}, ${cleanTitle})
  `

  const users = await db`
    SELECT id, username, display_name, bio, role, created_at FROM users WHERE id = ${authorId}
  ` as { id: string; username: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string }[]

  return {
    id,
    forumId: forum.id,
    title: cleanTitle,
    author: mapUser(users[0]),
    replyCount: 0,
    hidden: false,
    hiddenReason: null,
    hiddenBy: null,
    hiddenAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function getThread(
  id: string,
  opts: { page?: number; pageSize?: number; includeHidden?: boolean } = {},
): Promise<ThreadDetail | null> {
  if (useBlobStorage()) return blob.blobGetThread(id, opts)

  await ensureSchema()
  const db = sql()
  const { page, pageSize, offset } = parsePage(opts.page, opts.pageSize)
  const includeHidden = !!opts.includeHidden

  const threads = await db`
    SELECT t.id, t.title, t.hidden_at, t.hidden_by, t.hidden_reason, t.created_at, t.updated_at,
           f.id AS forum_id, f.slug AS forum_slug, f.name AS forum_name,
           u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created
    FROM threads t
    JOIN forums f ON f.id = t.forum_id
    JOIN users u ON u.id = t.author_id
    WHERE t.id = ${id}
  ` as {
    id: string; title: string; created_at: string; updated_at: string
    hidden_at: string | null; hidden_by: string | null; hidden_reason: string | null
    forum_id: string; forum_slug: string; forum_name: string
    author_id: string; username: string; display_name: string; bio: string; author_role: PublicUser['role']; author_created: string
  }[]

  const t = threads[0]
  if (!t) return null
  if (t.hidden_at && !includeHidden) return null

  const totalRows = includeHidden
    ? await db`SELECT COUNT(*)::int AS c FROM replies WHERE thread_id = ${id}` as { c: number }[]
    : await db`SELECT COUNT(*)::int AS c FROM replies WHERE thread_id = ${id} AND hidden_at IS NULL` as { c: number }[]

  type ReplyRow = {
    id: string; thread_id: string; content: string; created_at: string
    hidden_at: string | null; hidden_by: string | null; hidden_reason: string | null
    author_id: string; username: string; display_name: string; bio: string; author_role: PublicUser['role']; author_created: string
  }

  const replyRows = includeHidden
    ? await db`
        SELECT r.id, r.thread_id, r.content, r.hidden_at, r.hidden_by, r.hidden_reason, r.created_at,
               u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created
        FROM replies r
        JOIN users u ON u.id = r.author_id
        WHERE r.thread_id = ${id}
        ORDER BY r.created_at ASC
        LIMIT ${pageSize} OFFSET ${offset}
      ` as ReplyRow[]
    : await db`
        SELECT r.id, r.thread_id, r.content, r.hidden_at, r.hidden_by, r.hidden_reason, r.created_at,
               u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created
        FROM replies r
        JOIN users u ON u.id = r.author_id
        WHERE r.thread_id = ${id} AND r.hidden_at IS NULL
        ORDER BY r.created_at ASC
        LIMIT ${pageSize} OFFSET ${offset}
      ` as ReplyRow[]

  const replies: Reply[] = replyRows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    content: r.content,
    hidden: !!r.hidden_at,
    hiddenReason: r.hidden_reason,
    hiddenBy: r.hidden_by,
    hiddenAt: isoOrNull(r.hidden_at),
    createdAt: new Date(r.created_at).toISOString(),
    author: mapUser({ id: r.author_id, username: r.username, display_name: r.display_name, bio: r.bio, role: r.author_role, created_at: r.author_created }),
  }))

  return {
    id: t.id,
    title: t.title,
    forum: { id: t.forum_id, slug: t.forum_slug, name: t.forum_name },
    author: mapUser({ id: t.author_id, username: t.username, display_name: t.display_name, bio: t.bio, role: t.author_role, created_at: t.author_created }),
    replies,
    repliesPage: buildPageInfo(page, pageSize, totalRows[0]?.c ?? 0),
    hidden: !!t.hidden_at,
    hiddenReason: t.hidden_reason,
    hiddenBy: t.hidden_by,
    hiddenAt: isoOrNull(t.hidden_at),
    createdAt: new Date(t.created_at).toISOString(),
    updatedAt: new Date(t.updated_at).toISOString(),
  }
}

export async function addReply(threadId: string, authorId: string, content: string): Promise<Reply> {
  if (useBlobStorage()) return blob.blobAddReply(threadId, authorId, content)

  await ensureSchema()
  const db = sql()

  const clean = sanitizeText(content).slice(0, 5000)
  if (!clean) throw new Error('Message vide.')

  const threads = await db`SELECT id FROM threads WHERE id = ${threadId}` as { id: string }[]
  if (!threads[0]) throw new Error('Sujet introuvable.')

  const id = randomUUID()
  await db`INSERT INTO replies (id, thread_id, author_id, content) VALUES (${id}, ${threadId}, ${authorId}, ${clean})`
  await db`UPDATE threads SET updated_at = NOW() WHERE id = ${threadId}`

  const users = await db`
    SELECT id, username, display_name, bio, role, created_at FROM users WHERE id = ${authorId}
  ` as { id: string; username: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string }[]

  return {
    id,
    threadId,
    content: clean,
    hidden: false,
    hiddenReason: null,
    hiddenBy: null,
    hiddenAt: null,
    author: mapUser(users[0]),
    createdAt: new Date().toISOString(),
  }
}

export async function moderateThread(threadId: string, moderatorId: string, hidden: boolean, reason?: string): Promise<void> {
  if (useBlobStorage()) return blob.blobModerateThread(threadId, moderatorId, hidden, reason)

  await ensureSchema()
  const db = sql()
  const cleanReason = hidden ? sanitizeText(reason ?? '', 200) || null : null

  const result = hidden
    ? await db`
        UPDATE threads SET hidden_at = NOW(), hidden_by = ${moderatorId}, hidden_reason = ${cleanReason}
        WHERE id = ${threadId} RETURNING id
      ` as { id: string }[]
    : await db`
        UPDATE threads SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
        WHERE id = ${threadId} RETURNING id
      ` as { id: string }[]

  if (!result[0]) throw new Error('Sujet introuvable.')
}

export async function moderateReply(threadId: string, replyId: string, moderatorId: string, hidden: boolean, reason?: string): Promise<void> {
  if (useBlobStorage()) return blob.blobModerateReply(threadId, replyId, moderatorId, hidden, reason)

  await ensureSchema()
  const db = sql()
  const cleanReason = hidden ? sanitizeText(reason ?? '', 200) || null : null

  const result = hidden
    ? await db`
        UPDATE replies SET hidden_at = NOW(), hidden_by = ${moderatorId}, hidden_reason = ${cleanReason}
        WHERE id = ${replyId} AND thread_id = ${threadId} RETURNING id
      ` as { id: string }[]
    : await db`
        UPDATE replies SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
        WHERE id = ${replyId} AND thread_id = ${threadId} RETURNING id
      ` as { id: string }[]

  if (!result[0]) throw new Error('Réponse introuvable.')
}

export async function deleteThread(threadId: string): Promise<void> {
  if (useBlobStorage()) return blob.blobDeleteThread(threadId)

  await ensureSchema()
  const db = sql()
  const result = await db`DELETE FROM threads WHERE id = ${threadId} RETURNING id` as { id: string }[]
  if (!result[0]) throw new Error('Sujet introuvable.')
}

export async function deleteReply(threadId: string, replyId: string): Promise<void> {
  if (useBlobStorage()) return blob.blobDeleteReply(threadId, replyId)

  await ensureSchema()
  const db = sql()
  const result = await db`DELETE FROM replies WHERE id = ${replyId} AND thread_id = ${threadId} RETURNING id` as { id: string }[]
  if (!result[0]) throw new Error('Réponse introuvable.')
}

export async function listPages(): Promise<SitePage[]> {
  if (useBlobStorage()) return blob.blobListPages()

  await ensureSchema()
  const db = sql()
  const rows = await db`
    SELECT p.id, p.slug, p.title, p.content, p.created_at, p.updated_at,
           u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created
    FROM pages p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.published = true
    ORDER BY p.title ASC
  ` as {
    id: string; slug: string; title: string; content: string; created_at: string; updated_at: string
    author_id: string | null; username: string | null; display_name: string | null; bio: string | null; author_role: PublicUser['role'] | null; author_created: string | null
  }[]

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    author: r.author_id
      ? mapUser({ id: r.author_id, username: r.username!, display_name: r.display_name!, bio: r.bio ?? '', role: r.author_role ?? 'user', created_at: r.author_created! })
      : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }))
}

export async function getPageBySlug(slug: string): Promise<SitePage | null> {
  if (useBlobStorage()) return blob.blobGetPageBySlug(slug)

  await ensureSchema()
  const db = sql()
  const rows = await db`
    SELECT p.id, p.slug, p.title, p.content, p.created_at, p.updated_at,
           u.id AS author_id, u.username, u.display_name, u.bio, u.role AS author_role, u.created_at AS author_created
    FROM pages p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.slug = ${slug} AND p.published = true
  ` as {
    id: string; slug: string; title: string; content: string; created_at: string; updated_at: string
    author_id: string | null; username: string | null; display_name: string | null; bio: string | null; author_role: PublicUser['role'] | null; author_created: string | null
  }[]

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    author: r.author_id
      ? mapUser({ id: r.author_id, username: r.username!, display_name: r.display_name!, bio: r.bio ?? '', role: r.author_role ?? 'user', created_at: r.author_created! })
      : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }
}

export async function getUserProfile(username: string): Promise<UserProfile | null> {
  if (useBlobStorage()) return blob.blobGetUserProfile(username)

  await ensureSchema()
  const db = sql()
  const rows = await db`
    SELECT u.id, u.username, u.display_name, u.bio, u.role, u.created_at,
           (SELECT COUNT(*)::int FROM threads WHERE author_id = u.id AND hidden_at IS NULL) AS thread_count,
           (SELECT COUNT(*)::int FROM replies WHERE author_id = u.id AND hidden_at IS NULL) AS reply_count
    FROM users u WHERE u.username = ${username.toLowerCase()}
  ` as {
    id: string; username: string; display_name: string; bio: string; role: PublicUser['role']; created_at: string
    thread_count: number; reply_count: number
  }[]

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    bio: r.bio,
    role: r.role,
    createdAt: new Date(r.created_at).toISOString(),
    threadCount: r.thread_count,
    replyCount: r.reply_count,
  }
}
