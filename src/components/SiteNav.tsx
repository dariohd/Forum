import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface SiteNavProps {
  variant?: 'default' | 'overlay'
}

export function SiteNav({ variant = 'default' }: SiteNavProps) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const onMur = location.pathname === '/'

  return (
    <nav className={`site-nav${variant === 'overlay' ? ' overlay' : ''}`}>
      <Link to="/" className="site-nav-brand">Mur libre</Link>
      <div className="site-nav-links">
        {!onMur && <Link to="/">Mur</Link>}
        <Link to="/forums">Forums</Link>
        <Link to="/pages">Pages</Link>
        {user ? (
          <>
            <Link to={`/u/${user.username}`}>{user.displayName}</Link>
            <button type="button" className="link-btn" onClick={() => logout()}>Déconnexion</button>
          </>
        ) : (
          <>
            <Link to="/login">Connexion</Link>
            <Link to="/register" className="nav-cta">Inscription</Link>
          </>
        )}
      </div>
    </nav>
  )
}
