import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../lib/auth'
import { createThread, getForumBySlug } from '../lib/forum'
import { getSessionToken } from '../lib/http'
import { checkRateLimit, clientIp } from '../lib/security'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const slug = req.query.slug as string | undefined
  if (!slug) return res.status(400).json({ error: 'Forum manquant' })

  try {
    if (req.method === 'GET') {
      const data = await getForumBySlug(slug)
      if (!data) return res.status(404).json({ error: 'Forum introuvable' })
      return res.status(200).json(data)
    }

    if (req.method === 'POST') {
      await checkRateLimit(`thread:${clientIp(req)}`, 10, 3600)
      const user = await requireUser(getSessionToken(req))
      const body = req.body as { title?: string }
      const thread = await createThread(slug, user.id, String(body.title ?? ''))
      return res.status(201).json({ thread })
    }

    return res.status(405).json({ error: 'Méthode non autorisée' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Connexion') ? 401 : 400
    return res.status(status).json({ error: message })
  }
}
