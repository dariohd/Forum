import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'
import { fetchThread, postReply } from '../lib/site'
import type { ThreadDetail } from '../types'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function ThreadPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const load = () => {
    fetchThread(id)
      .then((d) => setThread(d.thread))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }

  useEffect(() => { load() }, [id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError(null)
    try {
      const { reply } = await postReply(id, content.trim())
      setThread((t) => t ? { ...t, replies: [...t.replies, reply], updatedAt: reply.createdAt } : t)
      setContent('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSending(false)
    }
  }

  if (!thread && !error) return <SiteLayout><p className="muted">Chargement…</p></SiteLayout>
  if (!thread) return <SiteLayout><p className="form-error">{error}</p></SiteLayout>

  return (
    <SiteLayout>
      <div className="panel">
        <header className="panel-head">
          <p className="breadcrumb">
            <Link to="/forums">Forums</Link> / <Link to={`/forums/${thread.forum.slug}`}>{thread.forum.name}</Link>
          </p>
          <h1>{thread.title}</h1>
          <p className="meta">
            <Link to={`/u/${thread.author.username}`}>{thread.author.displayName}</Link>
            {' · '}{formatDate(thread.createdAt)}
          </p>
        </header>

        <ul className="reply-list">
          {thread.replies.map((r) => (
            <li key={r.id} className="reply-card">
              <header>
                <Link to={`/u/${r.author.username}`}>{r.author.displayName}</Link>
                <time>{formatDate(r.createdAt)}</time>
              </header>
              <p>{r.content}</p>
            </li>
          ))}
        </ul>

        {user ? (
          <form className="reply-form" onSubmit={submit}>
            <textarea
              rows={4}
              placeholder="Ta réponse…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
            />
            <button type="submit" disabled={sending}>{sending ? 'Envoi…' : 'Répondre'}</button>
          </form>
        ) : (
          <p className="hint"><Link to="/login">Connecte-toi</Link> pour répondre.</p>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </SiteLayout>
  )
}
