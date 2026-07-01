import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addStroke } from '../lib/db'
import {
  checkRateLimit,
  clientIp,
  sanitizeAuthor,
  sanitizeColor,
  validatePoints,
} from '../lib/security'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const ip = clientIp(req)
    await checkRateLimit(`stroke:${ip}`, 40, 60)

    const body = req.body as {
      points?: unknown
      color?: unknown
      width?: unknown
      tool?: unknown
      author?: unknown
    }

    const points = validatePoints(body.points)
    const author = sanitizeAuthor(body.author)
    const color = sanitizeColor(body.color)
    const tool = body.tool === 'eraser' ? 'eraser' : 'pen'
    const width = Math.min(48, Math.max(1, Number(body.width) || 4))

    const stroke = await addStroke({ points, color, width, tool, author })
    return res.status(201).json(stroke)
  } catch (e) {
    console.error('POST /api/strokes', e)
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Trop de') ? 429 : 400
    return res.status(status).json({ error: message })
  }
}
