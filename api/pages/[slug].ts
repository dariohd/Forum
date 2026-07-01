import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPageBySlug } from '../../lib/forum.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  const slug = req.query.slug as string | undefined
  if (!slug) return res.status(400).json({ error: 'Page manquante' })

  try {
    const page = await getPageBySlug(slug)
    if (!page) return res.status(404).json({ error: 'Page introuvable' })
    return res.status(200).json({ page })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return res.status(500).json({ error: message })
  }
}
