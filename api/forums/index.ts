import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listForums } from '../lib/forum'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  try {
    const forums = await listForums()
    return res.status(200).json({ forums })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return res.status(500).json({ error: message })
  }
}
