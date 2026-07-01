import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { fetchPage } from '../lib/site'
import type { SitePage } from '../types'

export function PageView() {
  const { slug = '' } = useParams()
  const [page, setPage] = useState<SitePage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPage(slug)
      .then((d) => setPage(d.page))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [slug])

  if (!page && !error) return <SiteLayout><p className="muted">Chargement…</p></SiteLayout>
  if (!page) return <SiteLayout><p className="form-error">{error}</p></SiteLayout>

  return (
    <SiteLayout>
      <article className="panel page-article">
        <header className="panel-head">
          <p className="breadcrumb"><Link to="/pages">Pages</Link> / {page.title}</p>
          <h1>{page.title}</h1>
        </header>
        <div className="page-body">
          {page.content.split('\n').map((line, i) => (
            <p key={i}>{line || '\u00A0'}</p>
          ))}
        </div>
      </article>
    </SiteLayout>
  )
}
