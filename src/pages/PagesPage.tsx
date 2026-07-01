import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { fetchPages } from '../lib/site'
import type { SitePage } from '../types'

export function PagesPage() {
  const [pages, setPages] = useState<SitePage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPages()
      .then((d) => setPages(d.pages))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [])

  return (
    <SiteLayout>
      <div className="panel">
        <header className="panel-head">
          <h1>Pages</h1>
          <p>Contenus permanents et informations du site.</p>
        </header>
        {error && <p className="form-error">{error}</p>}
        <ul className="page-list">
          {pages.map((p) => (
            <li key={p.id}>
              <Link to={`/pages/${p.slug}`} className="page-card">
                <strong>{p.title}</strong>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </SiteLayout>
  )
}
