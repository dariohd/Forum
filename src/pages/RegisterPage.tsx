import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register(username, password, displayName || username)
      navigate('/forums')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SiteLayout>
      <form className="panel auth-panel" onSubmit={submit}>
        <h1>Inscription</h1>
        <label>
          Pseudo
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Nom affiché
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? '…' : 'Créer le compte'}</button>
        <p className="hint">Déjà inscrit ? <Link to="/login">Connexion</Link></p>
      </form>
    </SiteLayout>
  )
}
