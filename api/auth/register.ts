import type { VercelRequest, VercelResponse } from '@vercel/node'
import { registerUser } from '../lib/auth'
import { checkRateLimit, clientIp } from '../lib/security'
import { setSessionCookie } from '../lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
