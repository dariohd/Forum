import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { fetchForums } from '../lib/site'
import type { Forum } from '../types'

export function ForumsPage() {
  const [forums, setForums] = useState<Forum[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchForums()
      .then((d) => setForums(d.forums))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [])

  return (
    <SiteLayout>
      <div className="panel">
        <header className="panel-head">
          <h1>Forums</h1>
          <p>Discussions par thème, derrière le mur collaboratif.</p>
        </header>
        {error && <p className="form-error">{error}</p>}
        <ul className="forum-list">
          {forums.map((f) => (
            <li key={f.id}>
              <Link to={`/forums/${f.slug}`} className="forum-card">
                <strong>{f.name}</strong>
                <span>{f.description}</span>
                <em>{f.threadCount} sujet{f.threadCount !== 1 ? 's' : ''}</em>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteLayout>
  )
}
