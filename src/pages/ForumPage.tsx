import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Pagination } from '../components/Pagination'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'
import { createThread, deleteThread, fetchForum, moderateThread } from '../lib/site'
import type { Forum, PageInfo, ThreadSummary } from '../types'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function ForumPage() {
  const { slug = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const { user, isModerator } = useAuth()
  const [forum, setForum] = useState<Forum | null>(null)
  const [threads, setThreads] = useState<ThreadSummary[]>([])
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [moderating, setModerating] = useState<string | null>(null)

  const load = () => {
    fetchForum(slug, page)
      .then((d) => { setForum(d.forum); setThreads(d.threads); setPageInfo(d.page) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }

  useEffect(() => { load() }, [slug, page])

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

  const toggleHidden = async (thread: ThreadSummary) => {
    setModerating(thread.id)
    try {
      await moderateThread(thread.id, !thread.hidden)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setModerating(null)
    }
  }

  const remove = async (thread: ThreadSummary) => {
    if (!window.confirm(`Supprimer définitivement le sujet « ${thread.title} » ?`)) return
    setModerating(thread.id)
    try {
      await deleteThread(thread.id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setModerating(null)
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
            <li key={t.id} className={t.hidden ? 'thread-row-hidden' : undefined}>
              <div className="thread-row">
                <Link to={`/t/${t.id}`}>
                  <strong>{t.hidden && '[Masqué] '}{t.title}</strong>
                  <span>
                    {t.author.displayName} · {t.replyCount} réponse{t.replyCount !== 1 ? 's' : ''} · {formatDate(t.updatedAt)}
                  </span>
                </Link>
                {isModerator && (
                  <div className="mod-actions">
                    <button
                      type="button"
                      className="mod-btn"
                      disabled={moderating === t.id}
                      onClick={() => toggleHidden(t)}
                    >
                      {t.hidden ? 'Afficher' : 'Masquer'}
                    </button>
                    <button
                      type="button"
                      className="mod-btn mod-btn-danger"
                      disabled={moderating === t.id}
                      onClick={() => remove(t)}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
        {threads.length === 0 && <p className="muted">Aucun sujet pour l'instant.</p>}

        {pageInfo && (
          <Pagination page={pageInfo} onChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})} />
        )}
      </div>
    </SiteLayout>
  )
}
