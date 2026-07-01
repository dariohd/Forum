import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { SiteLayout } from '../components/SiteLayout'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
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
        <h1>Connexion</h1>
        <label>
          Pseudo
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Mot de passe
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? '…' : 'Entrer'}</button>
        <p className="hint">Pas de compte ? <Link to="/register">Inscription</Link></p>
      </form>
    </SiteLayout>
  )
}
