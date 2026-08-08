import { createHmac, timingSafeEqual } from 'crypto'

/** Janela anti-replay, em segundos. */
const TOLERANCE_SECONDS = 300

interface VerifyArgs {
  secret: string | undefined
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  nowMs?: number
}

/**
 * Verifica a assinatura Svix usada pelos webhooks da Resend.
 * Fail-closed: sem secret, sem cabeçalho ou fora da janela de tempo, rejeita.
 */
export function verifySvixSignature({
  secret,
  id,
  timestamp,
  signature,
  body,
  nowMs = Date.now(),
}: VerifyArgs): boolean {
  if (!secret) return false
  if (!id || !timestamp || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Math.floor(nowMs / 1000) - ts) > TOLERANCE_SECONDS) return false

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64')
  const expectedBuf = Buffer.from(expected)

  // O cabeçalho pode trazer várias assinaturas separadas por espaço, no formato "v1,<base64>".
  return signature.split(' ').some((part) => {
    const value = part.includes(',') ? part.split(',')[1] : part
    if (!value) return false
    const actual = Buffer.from(value)
    return actual.length === expectedBuf.length && timingSafeEqual(actual, expectedBuf)
  })
}
