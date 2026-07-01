import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addText } from '../lib/db'
import {
  checkRateLimit,
  clamp01,
  clientIp,
  sanitizeAuthor,
  sanitizeColor,
  sanitizeText,
} from '../lib/security'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const ip = clientIp(req)
    await checkRateLimit(`text:${ip}`, 20, 60)

    const body = req.body as {
      x?: unknown
      y?: unknown
      content?: unknown
      author?: unknown
      color?: unknown
      fontSize?: unknown
    }

    const content = sanitizeText(body.content)
    if (!content) return res.status(400).json({ error: 'Texte vide' })

    const text = await addText({
      x: clamp01(body.x),
      y: clamp01(body.y),
      content,
      author: sanitizeAuthor(body.author),
      color: sanitizeColor(body.color),
      fontSize: Math.min(72, Math.max(12, Number(body.fontSize) || 18)),
    })

    return res.status(201).json(text)
  } catch (e) {
    console.error('POST /api/texts', e)
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Trop de') ? 429 : 400
    return res.status(status).json({ error: message })
  }
}
