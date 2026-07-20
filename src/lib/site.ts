import type { Forum, PageInfo, PublicUser, Reply, SitePage, ThreadDetail, ThreadSummary, UserProfile } from '../types'

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erreur réseau')
  return data as T
}

export async function fetchMe(): Promise<PublicUser | null> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  const data = await res.json()
  return data.user ?? null
}

export async function register(input: { username: string; password: string; displayName: string }) {
  return parse<{ user: PublicUser }>(
    await fetch('/api/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function login(input: { username: string; password: string }) {
  return parse<{ user: PublicUser }>(
    await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export async function fetchForums() {
  return parse<{ forums: Forum[] }>(await fetch('/api/forums'))
}

export async function fetchForum(slug: string, page = 1) {
  return parse<{ forum: Forum; threads: ThreadSummary[]; page: PageInfo }>(
    await fetch(`/api/forums/${slug}?page=${page}`, { credentials: 'include' }),
  )
}

export async function createThread(slug: string, title: string) {
  return parse<{ thread: ThreadSummary }>(
    await fetch(`/api/forums/${slug}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
  )
}

export async function fetchThread(id: string, page = 1) {
  return parse<{ thread: ThreadDetail }>(
    await fetch(`/api/threads/${id}?page=${page}`, { credentials: 'include' }),
  )
}

export async function postReply(threadId: string, content: string) {
  return parse<{ reply: Reply }>(
    await fetch(`/api/threads/${threadId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),
  )
}

export async function moderateThread(threadId: string, hidden: boolean, reason?: string) {
  return parse<{ ok: true }>(
    await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden, reason }),
    }),
  )
}

export async function moderateReply(threadId: string, replyId: string, hidden: boolean, reason?: string) {
  return parse<{ ok: true }>(
    await fetch(`/api/threads/${threadId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hidden, reason, replyId }),
    }),
  )
}

export async function deleteThread(threadId: string) {
  return parse<{ ok: true }>(
    await fetch(`/api/threads/${threadId}`, { method: 'DELETE', credentials: 'include' }),
  )
}

export async function deleteReply(threadId: string, replyId: string) {
  return parse<{ ok: true }>(
    await fetch(`/api/threads/${threadId}?replyId=${replyId}`, { method: 'DELETE', credentials: 'include' }),
  )
}

export async function fetchPages() {
  return parse<{ pages: SitePage[] }>(await fetch('/api/pages'))
}

export async function fetchPage(slug: string) {
  return parse<{ page: SitePage }>(await fetch(`/api/pages/${slug}`))
}

export async function fetchUser(username: string) {
  return parse<{ user: UserProfile }>(await fetch(`/api/users/${username}`))
}
