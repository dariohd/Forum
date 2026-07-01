import type { VercelRequest, VercelResponse } from '@vercel/node'
import { loginUser } from '../lib/auth'
import { checkRateLimit, clientIp } from '../lib/security'
import { setSessionCookie } from '../lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
