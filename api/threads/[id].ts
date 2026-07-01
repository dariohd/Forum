import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireUser } from '../../lib/auth.js'
import { addReply, getThread } from '../../lib/forum.js'
import { getSessionToken } from '../../lib/http.js'
import { checkRateLimit, clientIp } from '../../lib/security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string | undefined
  if (!id) return res.status(400).json({ error: 'Sujet manquant' })

  try {
    if (req.method === 'GET') {
      const thread = await getThread(id)
      if (!thread) return res.status(404).json({ error: 'Sujet introuvable' })
      return res.status(200).json({ thread })
    }

    if (req.method === 'POST') {
      await checkRateLimit(`reply:${clientIp(req)}`, 30, 3600)
      const user = await requireUser(getSessionToken(req))
      const body = req.body as { content?: string }
      const reply = await addReply(id, user.id, String(body.content ?? ''))
      return res.status(201).json({ reply })
    }

    return res.status(405).json({ error: 'Méthode non autorisée' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Connexion') ? 401 : 400
    return res.status(status).json({ error: message })
  }
}
