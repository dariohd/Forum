import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { fetchUser } from '../lib/site'
import type { UserProfile } from '../types'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(iso))
}

export function UserPage() {
  const { username = '' } = useParams()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUser(username)
      .then((d) => setUser(d.user))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erreur'))
  }, [username])

  if (!user && !error) return <SiteLayout><p className="muted">Chargement…</p></SiteLayout>
  if (!user) return <SiteLayout><p className="form-error">{error}</p></SiteLayout>

  return (
    <SiteLayout>
      <div className="panel profile-panel">
        <h1>{user.displayName}</h1>
        <p className="meta">@{user.username} · membre depuis {formatDate(user.createdAt)}</p>
        {user.bio && <p>{user.bio}</p>}
        <dl className="profile-stats">
          <div><dt>Sujets</dt><dd>{user.threadCount}</dd></div>
          <div><dt>Réponses</dt><dd>{user.replyCount}</dd></div>
        </dl>
      </div>
    </SiteLayout>
  )
}
