import { randomUUID } from 'crypto'
import * as blob from './blob-store'
import { useBlobStorage } from './mode'
import { ensureSchema, sql } from './sql'
import { sanitizeText } from './security'
import type { Forum, PublicUser, Reply, SitePage, ThreadDetail, ThreadSummary, UserProfile } from './types'

function mapUser(row: { id: string; username: string; display_name: string; bio: string; created_at: string }): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

export async function listForums(): Promise<Forum[]> {
  if (useBlobStorage()) return blob.blobListForums()
  const db = sql()
  const rows = await db`
    SELECT f.id, f.slug, f.name, f.description, f.created_at,
           COUNT(t.id)::int AS thread_count
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

export async function getForumBySlug(slug: string): Promise<{ forum: Forum; threads: ThreadSummary[] } | null> {
  if (useBlobStorage()) return blob.blobGetForumBySlug(slug)

  await ensureSchema()
  const db = sql()

  const forums = await db`
    SELECT id, slug, name, description, created_at FROM forums WHERE slug = ${slug}
  ` as { id: string; slug: string; name: string; description: string; created_at: string }[]

  const f = forums[0]
  if (!f) return null

  const threads = await db`
    SELECT t.id, t.forum_id, t.title, t.created_at, t.updated_at,
           u.id AS author_id, u.username, u.display_name, u.bio, u.created_at AS author_created,
           COUNT(r.id)::int AS reply_count
    FROM threads t
    JOIN users u ON u.id = t.author_id
    LEFT JOIN replies r ON r.thread_id = t.id
    WHERE t.forum_id = ${f.id}
    GROUP BY t.id, u.id
    ORDER BY t.updated_at DESC
  ` as {
    id: string; forum_id: string; title: string; created_at: string; updated_at: string
    author_id: string; username: string; display_name: string; bio: string; author_created: string
    reply_count: number
  }[]

  return {
    forum: {
      id: f.id,
      slug: f.slug,
      name: f.name,
      description: f.description,
      threadCount: threads.length,
      createdAt: new Date(f.created_at).toISOString(),
    },
    threads: threads.map((t) => ({
      id: t.id,
      forumId: t.forum_id,
      title: t.title,
      author: mapUser({ id: t.author_id, username: t.username, display_name: t.display_name, bio: t.bio, created_at: t.author_created }),
      replyCount: t.reply_count,
      createdAt: new Date(t.created_at).toISOString(),
      updatedAt: new Date(t.updated_at).toISOString(),
    })),
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
    SELECT id, username, display_name, bio, created_at FROM users WHERE id = ${authorId}
  ` as { id: string; username: string; display_name: string; bio: string; created_at: string }[]

  return {
    id,
    forumId: forum.id,
    title: cleanTitle,
    author: mapUser(users[0]),
    replyCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export async function getThread(id: string): Promise<ThreadDetail | null> {
  if (useBlobStorage()) return blob.blobGetThread(id)

  await ensureSchema()
  const db = sql()

  const threads = await db`
    SELECT t.id, t.title, t.created_at, t.updated_at,
           f.id AS forum_id, f.slug AS forum_slug, f.name AS forum_name,
           u.id AS author_id, u.username, u.display_name, u.bio, u.created_at AS author_created
    FROM threads t
    JOIN forums f ON f.id = t.forum_id
    JOIN users u ON u.id = t.author_id
    WHERE t.id = ${id}
  ` as {
    id: string; title: string; created_at: string; updated_at: string
    forum_id: string; forum_slug: string; forum_name: string
    author_id: string; username: string; display_name: string; bio: string; author_created: string
  }[]

  const t = threads[0]
  if (!t) return null

  const replyRows = await db`
    SELECT r.id, r.thread_id, r.content, r.created_at,
           u.id AS author_id, u.username, u.display_name, u.bio, u.created_at AS author_created
    FROM replies r
    JOIN users u ON u.id = r.author_id
    WHERE r.thread_id = ${id}
    ORDER BY r.created_at ASC
  ` as {
    id: string; thread_id: string; content: string; created_at: string
    author_id: string; username: string; display_name: string; bio: string; author_created: string
  }[]

  const replies: Reply[] = replyRows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    content: r.content,
    createdAt: new Date(r.created_at).toISOString(),
    author: mapUser({ id: r.author_id, username: r.username, display_name: r.display_name, bio: r.bio, created_at: r.author_created }),
  }))

  return {
    id: t.id,
    title: t.title,
    forum: { id: t.forum_id, slug: t.forum_slug, name: t.forum_name },
    author: mapUser({ id: t.author_id, username: t.username, display_name: t.display_name, bio: t.bio, created_at: t.author_created }),
    replies,
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
    SELECT id, username, display_name, bio, created_at FROM users WHERE id = ${authorId}
  ` as { id: string; username: string; display_name: string; bio: string; created_at: string }[]

  return {
    id,
    threadId,
    content: clean,
    author: mapUser(users[0]),
    createdAt: new Date().toISOString(),
  }
}

export async function listPages(): Promise<SitePage[]> {
  if (useBlobStorage()) return blob.blobListPages()

  await ensureSchema()
  const db = sql()
  const rows = await db`
    SELECT p.id, p.slug, p.title, p.content, p.created_at, p.updated_at,
           u.id AS author_id, u.username, u.display_name, u.bio, u.created_at AS author_created
    FROM pages p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.published = true
    ORDER BY p.title ASC
  ` as {
    id: string; slug: string; title: string; content: string; created_at: string; updated_at: string
    author_id: string | null; username: string | null; display_name: string | null; bio: string | null; author_created: string | null
  }[]

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    author: r.author_id
      ? mapUser({ id: r.author_id, username: r.username!, display_name: r.display_name!, bio: r.bio ?? '', created_at: r.author_created! })
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
           u.id AS author_id, u.username, u.display_name, u.bio, u.created_at AS author_created
    FROM pages p
    LEFT JOIN users u ON u.id = p.author_id
    WHERE p.slug = ${slug} AND p.published = true
  ` as {
    id: string; slug: string; title: string; content: string; created_at: string; updated_at: string
    author_id: string | null; username: string | null; display_name: string | null; bio: string | null; author_created: string | null
  }[]

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    author: r.author_id
      ? mapUser({ id: r.author_id, username: r.username!, display_name: r.display_name!, bio: r.bio ?? '', created_at: r.author_created! })
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
    SELECT u.id, u.username, u.display_name, u.bio, u.created_at,
           (SELECT COUNT(*)::int FROM threads WHERE author_id = u.id) AS thread_count,
           (SELECT COUNT(*)::int FROM replies WHERE author_id = u.id) AS reply_count
    FROM users u WHERE u.username = ${username.toLowerCase()}
  ` as {
    id: string; username: string; display_name: string; bio: string; created_at: string
    thread_count: number; reply_count: number
  }[]

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    bio: r.bio,
    createdAt: new Date(r.created_at).toISOString(),
    threadCount: r.thread_count,
    replyCount: r.reply_count,
  }
}
