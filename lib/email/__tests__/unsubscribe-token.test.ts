import { signUnsubscribeToken, verifyUnsubscribeToken } from '../unsubscribe-token'

const SECRET = 'segredo-de-teste'

describe('unsubscribe token', () => {
  it('round-trips email and campaignId', () => {
    const token = signUnsubscribeToken('joao@x.com', 'camp-1', SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      email: 'joao@x.com',
      campaignId: 'camp-1',
    })
  })

  it('round-trips with null campaignId', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({
      email: 'joao@x.com',
      campaignId: null,
    })
  })

  it('normalizes the email before signing', () => {
    const token = signUnsubscribeToken('  Joao@X.COM ', null, SECRET)
    expect(verifyUnsubscribeToken(token, SECRET)?.email).toBe('joao@x.com')
  })

  it('rejects a token signed with another secret', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    expect(verifyUnsubscribeToken(token, 'outro-segredo')).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = signUnsubscribeToken('joao@x.com', null, SECRET)
    const [payload, sig] = token.split('.')
    const forged = Buffer.from('{"e":"vitima@x.com","c":null}').toString('base64url')
    expect(verifyUnsubscribeToken(`${forged}.${sig}`, SECRET)).toBeNull()
    expect(payload).toBeTruthy()
  })

  it('rejects malformed tokens', () => {
    expect(verifyUnsubscribeToken('', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('sem-ponto', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('a.b.c', SECRET)).toBeNull()
    expect(verifyUnsubscribeToken('!!!.???', SECRET)).toBeNull()
  })

  it('produces url-safe tokens', () => {
    const token = signUnsubscribeToken('joao+tag@x.com', 'camp-1', SECRET)
    expect(token).toBe(encodeURIComponent(token))
  })

  it('rejects an invalid email at signing time', () => {
    expect(() => signUnsubscribeToken('sem-arroba', null, SECRET)).toThrow()
  })
})
