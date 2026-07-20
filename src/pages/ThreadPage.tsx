import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'
import { deleteReply, deleteThread, fetchThread, moderateReply, moderateThread, postReply } from '../lib/site'
import type { Reply, ThreadDetail } from '../types'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function ThreadPage() {
  const { id = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const { user, isModerator } = useAuth()
  const [thread, setThread] = useState<ThreadDetail | null>(null)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [moderating, setModerating] = useState<string | null>(null)

  const load = () => {
    fetchThread(id, page)
      .then((d) => setThread(d.thread))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }

  useEffect(() => { load() }, [id, page])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSending(true)
    setError(null)
    try {
      await postReply(id, content.trim())
      setContent('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSending(false)
    }
  }

  const toggleThreadHidden = async () => {
    if (!thread) return
    setModerating('thread')
    try {
      await moderateThread(thread.id, !thread.hidden)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setModerating(null)
    }
  }

  const removeThread = async () => {
    if (!thread) return
    if (!window.confirm('Supprimer définitivement ce sujet et ses réponses ?')) return
    try {
      await deleteThread(thread.id)
      window.location.href = `/forums/${thread.forum.slug}`
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  const toggleReplyHidden = async (reply: Reply) => {
    setModerating(reply.id)
    try {
      await moderateReply(id, reply.id, !reply.hidden)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setModerating(null)
    }
  }

  const removeReply = async (reply: Reply) => {
    if (!window.confirm('Supprimer définitivement cette réponse ?')) return
    setModerating(reply.id)
    try {
      await deleteReply(id, reply.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setModerating(null)
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

        {thread.hidden && (
          <p className="mod-banner">
            Ce sujet est masqué par la modération{thread.hiddenReason ? ` — ${thread.hiddenReason}` : ''}.
          </p>
        )}

        {isModerator && (
          <div className="mod-actions">
            <button type="button" className="mod-btn" onClick={toggleThreadHidden} disabled={moderating === 'thread'}>
              {thread.hidden ? 'Afficher le sujet' : 'Masquer le sujet'}
            </button>
            <button type="button" className="mod-btn mod-btn-danger" onClick={removeThread}>
              Supprimer le sujet
            </button>
          </div>
        )}

        <ul className="reply-list">
          {thread.replies.map((r) => (
            <li key={r.id} className={r.hidden ? 'reply-card reply-card-hidden' : 'reply-card'}>
              <header>
                <Link to={`/u/${r.author.username}`}>{r.author.displayName}</Link>
                <time>{formatDate(r.createdAt)}</time>
              </header>
              {r.hidden && <p className="mod-banner mod-banner-small">Masqué par la modération{r.hiddenReason ? ` — ${r.hiddenReason}` : ''}.</p>}
              <p>{r.content}</p>
              {isModerator && (
                <div className="mod-actions">
                  <button
                    type="button"
                    className="mod-btn"
                    disabled={moderating === r.id}
                    onClick={() => toggleReplyHidden(r)}
                  >
                    {r.hidden ? 'Afficher' : 'Masquer'}
                  </button>
                  <button
                    type="button"
                    className="mod-btn mod-btn-danger"
                    disabled={moderating === r.id}
                    onClick={() => removeReply(r)}
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <Pagination page={thread.repliesPage} onChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})} />

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
