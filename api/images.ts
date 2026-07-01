import type { VercelRequest, VercelResponse } from '@vercel/node'
import { addImage } from '../lib/db.js'
import {
  checkRateLimit,
  clamp01,
  clientIp,
  isValidBlobUrl,
  sanitizeAuthor,
} from '../lib/security.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const ip = clientIp(req)
    await checkRateLimit(`image:${ip}`, 8, 60)

    const body = req.body as {
      x?: unknown
      y?: unknown
      width?: unknown
      height?: unknown
      url?: unknown
      author?: unknown
    }

    const url = String(body.url ?? '')
    if (!isValidBlobUrl(url)) {
      return res.status(400).json({ error: 'URL de fichier non autorisée' })
    }

    const width = Math.min(0.6, Math.max(0.05, Number(body.width) || 0.2))
    const height = Math.min(0.6, Math.max(0.05, Number(body.height) || 0.2))

    const image = await addImage({
      x: clamp01(body.x),
      y: clamp01(body.y),
      width,
      height,
      url,
      author: sanitizeAuthor(body.author),
    })

    return res.status(201).json(image)
  } catch (e) {
    console.error('POST /api/images', e)
    const message = e instanceof Error ? e.message : 'Erreur serveur'
    const status = message.includes('Trop de') ? 429 : 400
    return res.status(status).json({ error: message })
  }
}
