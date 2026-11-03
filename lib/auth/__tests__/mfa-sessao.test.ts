/**
 * @jest-environment node
 */
/**
 * O que estes casos protegem:
 *  - sessão sem a segunda etapa (inclusive os cookies emitidos antes do 2FA
 *    existir) não vale mais;
 *  - o token da etapa pendente e o de sessão não se confundem;
 *  - o segredo do autenticador nunca é gravado em claro e não decifra adulterado.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-mfa-sessao-0123456789'
process.env.MFA_ENCRYPTION_KEY = 'chave-de-teste-mfa-0123456789abcdef-0123456789'

import {
  createMfaPendingToken,
  createSessionToken,
  verifyMfaPendingToken,
  verifySessionToken,
} from '../session'
import { cifrarSegredo, decifrarSegredo } from '../totp-crypto'

const USUARIO = {
  id: 'u-1',
  email: 'ana@somma.run',
  full_name: 'Ana',
  role: 'admin',
  permissions: null,
}

function b64url(texto: string): string {
  return Buffer.from(texto).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function assinarComoSessaoAntiga(payload: Record<string, unknown>): Promise<string> {
  // Reproduz a assinatura de session.ts (HMAC-SHA256 do payload em base64url).
  const encoded = b64url(JSON.stringify(payload))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SESSION_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded)))
  return `${encoded}.${Buffer.from(sig).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

describe('sessão exige a segunda etapa', () => {
  it('a sessão emitida depois do 2FA carrega mfa e é aceita', async () => {
    const token = await createSessionToken(USUARIO)
    const sessao = await verifySessionToken(token)
    expect(sessao).toMatchObject({ sub: 'u-1', mfa: true })
  })

  it('cookie antigo, assinado corretamente mas sem mfa, é recusado', async () => {
    const antigo = await assinarComoSessaoAntiga({
      sub: 'u-1',
      email: 'ana@somma.run',
      full_name: 'Ana',
      role: 'admin',
      permissions: null,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
    expect(await verifySessionToken(antigo)).toBeNull()
  })
})

describe('token da etapa pendente', () => {
  it('ida e volta preserva usuário e etapa', async () => {
    const token = await createMfaPendingToken('u-1', 'cadastro')
    expect(await verifyMfaPendingToken(token)).toMatchObject({ sub: 'u-1', etapa: 'cadastro' })
  })

  it('não vale como sessão, e a sessão não vale como etapa pendente', async () => {
    const pendente = await createMfaPendingToken('u-1', 'codigo')
    expect(await verifySessionToken(pendente)).toBeNull()

    const sessao = await createSessionToken(USUARIO)
    expect(await verifyMfaPendingToken(sessao)).toBeNull()
  })

  it('recusa token adulterado', async () => {
    const token = await createMfaPendingToken('u-1', 'codigo')
    const [, assinatura] = token.split('.')
    const outro = b64url(JSON.stringify({ sub: 'u-2', etapa: 'codigo', exp: Math.floor(Date.now() / 1000) + 600 }))
    expect(await verifyMfaPendingToken(`${outro}.${assinatura}`)).toBeNull()
  })
})

describe('cifra do segredo do autenticador', () => {
  it('ida e volta, sem o segredo em claro no texto gravado', () => {
    const gravado = cifrarSegredo('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
    expect(gravado.startsWith('v1:')).toBe(true)
    expect(gravado).not.toContain('GEZDGNBVGY3TQOJQ')
    expect(decifrarSegredo(gravado)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  it('o mesmo segredo cifra diferente a cada vez (IV aleatório)', () => {
    expect(cifrarSegredo('ABC')).not.toBe(cifrarSegredo('ABC'))
  })

  it('texto adulterado não decifra', () => {
    const [v, iv, tag, ct] = cifrarSegredo('GEZDGNBVGY3TQOJQ').split(':')
    const ctAlterado = Buffer.from(ct, 'base64')
    ctAlterado[0] ^= 1
    expect(() => decifrarSegredo([v, iv, tag, ctAlterado.toString('base64')].join(':'))).toThrow()
  })

  it('sem MFA_ENCRYPTION_KEY, falha fechado', () => {
    const chave = process.env.MFA_ENCRYPTION_KEY
    delete process.env.MFA_ENCRYPTION_KEY
    try {
      expect(() => cifrarSegredo('ABC')).toThrow(/MFA_ENCRYPTION_KEY/)
    } finally {
      process.env.MFA_ENCRYPTION_KEY = chave
    }
  })
})
