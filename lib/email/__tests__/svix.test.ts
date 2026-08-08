import { createHmac } from 'crypto'
import { verifySvixSignature } from '../svix'

const SECRET = `whsec_${Buffer.from('chave-secreta-do-webhook').toString('base64')}`
const ID = 'msg_123'
const BODY = '{"type":"email.delivered"}'
const NOW_MS = 1_700_000_000_000
const TS = String(Math.floor(NOW_MS / 1000))

function validSignature(id = ID, ts = TS, body = BODY, secret = SECRET): string {
  const bytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', bytes).update(`${id}.${ts}.${body}`).digest('base64')
  return `v1,${mac}`
}

const base = { secret: SECRET, id: ID, timestamp: TS, body: BODY, nowMs: NOW_MS }

describe('verifySvixSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifySvixSignature({ ...base, signature: validSignature() })).toBe(true)
  })

  it('accepts when one of several space-separated signatures matches', () => {
    const sig = `v1,invalido ${validSignature()}`
    expect(verifySvixSignature({ ...base, signature: sig })).toBe(true)
  })

  it('is fail-closed when the secret is missing', () => {
    expect(verifySvixSignature({ ...base, secret: undefined, signature: validSignature() })).toBe(false)
    expect(verifySvixSignature({ ...base, secret: '', signature: validSignature() })).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(verifySvixSignature({ ...base, signature: null })).toBe(false)
    expect(verifySvixSignature({ ...base, id: null, signature: validSignature() })).toBe(false)
    expect(verifySvixSignature({ ...base, timestamp: null, signature: validSignature() })).toBe(false)
  })

  it('rejects a tampered body', () => {
    const sig = validSignature()
    expect(verifySvixSignature({ ...base, body: '{"type":"email.bounced"}', signature: sig })).toBe(false)
  })

  it('rejects a signature from another secret', () => {
    const other = `whsec_${Buffer.from('outra-chave').toString('base64')}`
    expect(verifySvixSignature({ ...base, signature: validSignature(ID, TS, BODY, other) })).toBe(false)
  })

  it('rejects a timestamp outside the 5 minute window', () => {
    const oldTs = String(Math.floor(NOW_MS / 1000) - 400)
    expect(
      verifySvixSignature({ ...base, timestamp: oldTs, signature: validSignature(ID, oldTs) }),
    ).toBe(false)

    const futureTs = String(Math.floor(NOW_MS / 1000) + 400)
    expect(
      verifySvixSignature({ ...base, timestamp: futureTs, signature: validSignature(ID, futureTs) }),
    ).toBe(false)
  })

  it('accepts a timestamp just inside the window', () => {
    const ts = String(Math.floor(NOW_MS / 1000) - 250)
    expect(verifySvixSignature({ ...base, timestamp: ts, signature: validSignature(ID, ts) })).toBe(true)
  })

  it('rejects a non-numeric timestamp', () => {
    expect(verifySvixSignature({ ...base, timestamp: 'abc', signature: validSignature(ID, 'abc') })).toBe(false)
  })
})
