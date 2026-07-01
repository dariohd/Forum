import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { getUserByToken } from '../lib/auth'
import { getSessionToken } from '../lib/http'
import { checkRateLimit, clientIp } from '../lib/security'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' })
  }

  try {
    const user = await getUserByToken(getSessionToken(req))
    if (!user) {
      return res.status(401).json({ error: 'Connexion requise pour envoyer un fichier' })
    }

    const ip = clientIp(req)
    await checkRateLimit(`upload:${ip}`, 12, 60)

    const body = req.body as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request: new Request(`https://${req.headers.host ?? 'localhost'}/api/upload`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maximumSizeInBytes: 8 * 1024 * 1024,
        addRandomSuffix: true,
      }),
    })

    return res.status(200).json(jsonResponse)
  } catch (e) {
    console.error('POST /api/upload', e)
    const message = e instanceof Error ? e.message : 'Upload impossible'
    const status = message.includes('Trop de') ? 429 : 400
    return res.status(status).json({ error: message })
  }
}
