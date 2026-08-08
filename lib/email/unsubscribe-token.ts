import { createHmac, timingSafeEqual } from 'crypto'
import { normalizeEmail } from './normalize'

interface TokenPayload {
  e: string
  c: string | null
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function signUnsubscribeToken(
  email: string,
  campaignId: string | null,
  secret: string,
): string {
  const normalized = normalizeEmail(email)
  if (!normalized) throw new Error(`E-mail inválido para token de descadastro: ${email}`)

  const body: TokenPayload = { e: normalized, c: campaignId }
  const payload = Buffer.from(JSON.stringify(body)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
): { email: string; campaignId: string | null } | null {
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payload, signature] = parts
  if (!payload || !signature) return null

  const expected = sign(payload, secret)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload
    const email = normalizeEmail(body.e)
    if (!email) return null
    return { email, campaignId: typeof body.c === 'string' ? body.c : null }
  } catch {
    return null
  }
}
