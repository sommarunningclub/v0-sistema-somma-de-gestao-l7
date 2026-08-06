/**
 * @jest-environment node
 */
process.env.SESSION_SECRET = 'segredo-de-teste-insider'

import {
  createInsiderToken,
  verifyInsiderToken,
  INSIDER_SESSION_COOKIE,
  INSIDER_SESSION_MAX_AGE_SEC,
} from '../insider-session'
import { createSessionToken } from '../session'

const insider = { id: 'uuid-insider-1', cpf: '529.982.247-25', nome: 'João Silva' }

describe('insider-session', () => {
  it('cria e verifica um token válido', async () => {
    const token = await createInsiderToken(insider)
    const payload = await verifyInsiderToken(token)
    expect(payload).not.toBeNull()
    expect(payload!.sub).toBe('uuid-insider-1')
    expect(payload!.cpf).toBe('529.982.247-25')
    expect(payload!.nome).toBe('João Silva')
    expect(payload!.typ).toBe('insider')
  })

  it('usa cookie próprio, diferente do admin', () => {
    expect(INSIDER_SESSION_COOKIE).toBe('somma_insider_session')
  })

  it('expira em 30 dias', async () => {
    const antes = Math.floor(Date.now() / 1000)
    const token = await createInsiderToken(insider)
    const payload = await verifyInsiderToken(token)
    expect(INSIDER_SESSION_MAX_AGE_SEC).toBe(60 * 60 * 24 * 30)
    expect(payload!.exp).toBeGreaterThanOrEqual(antes + INSIDER_SESSION_MAX_AGE_SEC - 5)
  })

  it('rejeita token com assinatura adulterada', async () => {
    const token = await createInsiderToken(insider)
    const [encoded] = token.split('.')
    expect(await verifyInsiderToken(`${encoded}.assinaturaFalsa`)).toBeNull()
  })

  it('rejeita assinatura forjada do mesmo tamanho', async () => {
    const token = await createInsiderToken(insider)
    const [encoded, assinatura] = token.split('.')
    const forjada = assinatura.slice(0, -1) + (assinatura.endsWith('A') ? 'B' : 'A')
    expect(forjada).toHaveLength(assinatura.length)
    expect(await verifyInsiderToken(`${encoded}.${forjada}`)).toBeNull()
  })

  it('rejeita token com payload adulterado', async () => {
    const token = await createInsiderToken(insider)
    const [, assinatura] = token.split('.')
    const outro = Buffer.from(JSON.stringify({ ...insider, sub: 'outro-id' }))
      .toString('base64url')
    expect(await verifyInsiderToken(`${outro}.${assinatura}`)).toBeNull()
  })

  it('rejeita token malformado', async () => {
    expect(await verifyInsiderToken('')).toBeNull()
    expect(await verifyInsiderToken('semponto')).toBeNull()
  })

  it('rejeita token expirado', async () => {
    const token = await createInsiderToken(insider)
    const futuro = (Date.now() / 1000 + INSIDER_SESSION_MAX_AGE_SEC + 60) * 1000
    const spy = jest.spyOn(Date, 'now').mockReturnValue(futuro)
    try {
      expect(await verifyInsiderToken(token)).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('REJEITA um token de sessão de ADMIN', async () => {
    const tokenAdmin = await createSessionToken({
      id: 'admin-1',
      email: 'admin@exemplo.com',
      full_name: 'Admin',
      role: 'admin',
      permissions: null,
    })
    expect(await verifyInsiderToken(tokenAdmin)).toBeNull()
  })
})
