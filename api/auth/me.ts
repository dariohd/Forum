import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserByToken } from '../lib/auth'
import { getSessionToken } from '../lib/http'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  const user = await getUserByToken(getSessionToken(req))
  return res.status(200).json({ user })
}
