import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserProfile } from '../lib/forum'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' })
  const username = req.query.username as string | undefined
  if (!username) return res.status(400).json({ error: 'Utilisateur manquant' })

  try {
    const user = await getUserProfile(username)
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })
    return res.status(200).json({ user })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    return res.status(500).json({ error: message })
  }
}
