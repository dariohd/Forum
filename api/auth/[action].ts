import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserByToken, loginUser, logoutToken, registerUser } from '../../lib/auth.js'
import { clearSessionCookie, getSessionToken, setSessionCookie } from '../../lib/http.js'
import { checkRateLimit, clientIp } from '../../lib/security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = String(req.query.action ?? '')

  switch (action) {
    case 'login':
      return handleLogin(req, res)
    case 'logout':
      return handleLogout(req, res)
    case 'me':
      return handleMe(req, res)
    case 'register':
      return handleRegister(req, res)
    default:
      return res.status(404).json({ error: 'Route auth inconnue' })
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  try {
    await checkRateLimit(`login:${clientIp(req)}`, 20, 900)
    const body = req.body as { username?: string; password?: string }
    const { user, token } = await loginUser(String(body.username ?? ''), String(body.password ?? ''))
    setSessionCookie(res, token)
    return res.status(200).json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Connexion impossible'
    return res.status(401).json({ error: message })
  }
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  await logoutToken(getSessionToken(req))
  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  const user = await getUserByToken(getSessionToken(req))
  return res.status(200).json({ user })
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  try {
    await checkRateLimit(`register:${clientIp(req)}`, 5, 3600)
    const body = req.body as { username?: string; password?: string; displayName?: string }
    const { user, token } = await registerUser({
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      displayName: String(body.displayName ?? ''),
    })
    setSessionCookie(res, token)
    return res.status(201).json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Inscription impossible'
    return res.status(400).json({ error: message })
  }
}
