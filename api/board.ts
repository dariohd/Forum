import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBoard, getStats } from '../lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const since = typeof req.query.since === 'string' ? req.query.since : undefined
    const board = await getBoard(since)
    const stats = since ? undefined : await getStats()
    return res.status(200).json({ ...board, stats })
  } catch (e) {
    console.error('GET /api/board', e)
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return res.status(500).json({ error: message })
  }
}
