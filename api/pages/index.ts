import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listPages } from '../../lib/forum.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  try {
    const pages = await listPages()
    return res.status(200).json({ pages })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return res.status(500).json({ error: message })
  }
}
