import type { VercelRequest, VercelResponse } from '@vercel/node'
import { logoutToken } from '../lib/auth'
import { clearSessionCookie, getSessionToken } from '../lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })
  await logoutToken(getSessionToken(req))
  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}
