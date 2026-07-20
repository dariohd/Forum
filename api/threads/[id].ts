import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getUserByToken, isModerator, requireModerator, requireUser } from '../../lib/auth.js'
import { addReply, deleteReply, deleteThread, getThread, moderateReply, moderateThread } from '../../lib/forum.js'
import { getSessionToken } from '../../lib/http.js'
import { checkRateLimit, clientIp } from '../../lib/security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = req.query.id as string | undefined
  if (!id) return res.status(400).json({ error: 'Sujet manquant' })

  try {
    if (req.method === 'GET') {
      const viewer = await getUserByToken(getSessionToken(req))
      const page = Number(req.query.page)
      const pageSize = Number(req.query.pageSize)
      const thread = await getThread(id, {
        page: Number.isFinite(page) ? page : undefined,
        pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
        includeHidden: !!viewer && isModerator(viewer),
      })
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

    if (req.method === 'PATCH') {
      const moderator = await requireModerator(getSessionToken(req))
      const body = req.body as { hidden?: boolean; reason?: string; replyId?: string }
      const hidden = !!body.hidden
      if (body.replyId) {
        await moderateReply(id, body.replyId, moderator.id, hidden, body.reason)
      } else {
        await moderateThread(id, moderator.id, hidden, body.reason)
      }
      return res.status(200).json({ ok: true })
    }

    if (req.method === 'DELETE') {
      await requireModerator(getSessionToken(req))
      const replyId = req.query.replyId as string | undefined
      if (replyId) {
        await deleteReply(id, replyId)
      } else {
        await deleteThread(id)
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Méthode non autorisée' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Connexion') ? 401 : message.includes('modérateurs') ? 403 : 400
    return res.status(status).json({ error: message })
  }
}
