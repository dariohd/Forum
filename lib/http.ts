import type { VercelRequest, VercelResponse } from '@vercel/node'

const SESSION_COOKIE = 'mur_session'

export function getSessionToken(req: VercelRequest): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === SESSION_COOKIE) return rest.join('=')
  }
  return undefined
}

export function setSessionCookie(res: VercelResponse, token: string) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure}`,
  )
}

export function clearSessionCookie(res: VercelResponse) {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  )
}
