import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'
import { createThread, fetchForum } from '../lib/site'
import type { Forum, ThreadSummary } from '../types'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function ForumPage() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const [forum, setForum] = useState<Forum | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const load = () => {
    fetchForum(slug)
      .then((d) => { setForum(d.forum); setThreads(d.threads) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }

  useEffect(() => { load() }, [slug])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSending(true)
    setError(null)
    try {
      const { thread } = await createThread(slug, title.trim())
      setThreads((prev) => [thread, ...prev])
      setTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSending(false)
    }
  }

  if (!forum && !error) return <SiteLayout><p className="muted">Chargement…</p></SiteLayout>

  return (
    <SiteLayout>
      <div className="panel">
        <header className="panel-head">
          <p className="breadcrumb"><Link to="/forums">Forums</Link> / {forum?.name}</p>
          <h1>{forum?.name}</h1>
          <p>{forum?.description}</p>
        </header>

        {user ? (
          <form className="thread-form" onSubmit={submit}>
            <input
              placeholder="Nouveau sujet…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
            <button type="submit" disabled={sending}>{sending ? '…' : 'Ouvrir'}</button>
          </form>
        ) : (
          <p className="hint"><Link to="/login">Connecte-toi</Link> pour ouvrir un sujet.</p>
        )}

        {error && <p className="form-error">{error}</p>}

        <ul className="thread-list">
          {threads.map((t) => (
            <li key={t.id}>
              <Link to={`/t/${t.id}`} className="thread-row">
                <strong>{t.title}</strong>
                <span>
                  {t.author.displayName} · {t.replyCount} réponse{t.replyCount !== 1 ? 's' : ''} · {formatDate(t.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {threads.length === 0 && <p className="muted">Aucun sujet pour l'instant.</p>}
      </div>
    </SiteLayout>
  )
}
