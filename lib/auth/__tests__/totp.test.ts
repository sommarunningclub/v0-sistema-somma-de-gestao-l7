/**
 * @jest-environment node
 */
import { getRequiredPermission, isPublicApiRoute } from '../route-permissions'
import {
  base32Decode,
  base32Encode,
  codigoNoPasso,
  formatarSegredoParaDigitar,
  gerarSegredoTotp,
  otpauthUri,
  passoAtual,
  verificarTotp,
} from '../totp'

// Segredo dos vetores de teste da RFC 6238 (SHA-1): "12345678901234567890".
const SEGREDO_RFC = new TextEncoder().encode('12345678901234567890')

describe('codigoNoPasso — vetores oficiais da RFC 6238 (SHA-1)', () => {
  const vetores: Array<[number, string]> = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ]
  it.each(vetores)('T=%i → %s', (segundos, esperado) => {
    const passo = Math.floor(segundos / 30)
    expect(codigoNoPasso(SEGREDO_RFC, passo, 8)).toBe(esperado)
    // O Google Authenticator usa 6 dígitos: os 6 finais do mesmo valor.
    expect(codigoNoPasso(SEGREDO_RFC, passo)).toBe(esperado.slice(-6))
  })
})

describe('base32', () => {
  it('ida e volta preserva os bytes', () => {
    const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 42])
    expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes))
  })

  it('codifica o segredo da RFC como o Google Authenticator espera', () => {
    expect(base32Encode(SEGREDO_RFC)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')
  })

  it('aceita minúsculas, espaços e hífens ao decodificar', () => {
    expect(base32Encode(base32Decode('gezd gnbv-gy3t qojq'))).toBe('GEZDGNBVGY3TQOJQ')
  })

  it('recusa caracteres fora do alfabeto', () => {
    expect(() => base32Decode('ABC1')).toThrow()
  })
})

describe('gerarSegredoTotp', () => {
  it('gera 160 bits em base32 (32 caracteres), diferente a cada chamada', () => {
    const a = gerarSegredoTotp()
    const b = gerarSegredoTotp()
    expect(a).toMatch(/^[A-Z2-7]{32}$/)
    expect(base32Decode(a)).toHaveLength(20)
    expect(a).not.toBe(b)
  })
})

describe('verificarTotp', () => {
  const segredo = base32Encode(SEGREDO_RFC)
  const agoraMs = 1_234_567_890_000
  const passo = passoAtual(agoraMs)
  const codigoDe = (p: number) => codigoNoPasso(SEGREDO_RFC, p)

  it('aceita o código do passo atual e devolve o passo', () => {
    expect(verificarTotp(segredo, codigoDe(passo), { agoraMs })).toBe(passo)
  })

  it('aceita ±1 passo (relógio do celular um pouco fora) e recusa ±2', () => {
    expect(verificarTotp(segredo, codigoDe(passo - 1), { agoraMs })).toBe(passo - 1)
    expect(verificarTotp(segredo, codigoDe(passo + 1), { agoraMs })).toBe(passo + 1)
    expect(verificarTotp(segredo, codigoDe(passo - 2), { agoraMs })).toBeNull()
    expect(verificarTotp(segredo, codigoDe(passo + 2), { agoraMs })).toBeNull()
  })

  it('aceita o código com espaço, como o app mostra', () => {
    const c = codigoDe(passo)
    expect(verificarTotp(segredo, `${c.slice(0, 3)} ${c.slice(3)}`, { agoraMs })).toBe(passo)
  })

  it('recusa código já usado (mesmo passo ou anterior)', () => {
    expect(verificarTotp(segredo, codigoDe(passo), { agoraMs, ultimoPassoUsado: passo })).toBeNull()
    expect(verificarTotp(segredo, codigoDe(passo - 1), { agoraMs, ultimoPassoUsado: passo - 1 })).toBeNull()
    expect(verificarTotp(segredo, codigoDe(passo), { agoraMs, ultimoPassoUsado: passo - 1 })).toBe(passo)
  })

  it('recusa código errado, curto ou vazio', () => {
    const certo = codigoDe(passo)
    const errado = String((Number(certo) + 1) % 1_000_000).padStart(6, '0')
    expect(verificarTotp(segredo, errado, { agoraMs })).toBeNull()
    expect(verificarTotp(segredo, certo.slice(0, 5), { agoraMs })).toBeNull()
    expect(verificarTotp(segredo, '', { agoraMs })).toBeNull()
  })
})

describe('otpauthUri / formatarSegredoParaDigitar', () => {
  it('monta a URI que o Google Authenticator lê', () => {
    const uri = otpauthUri('ana@somma.run', 'GEZDGNBVGY3TQOJQ')
    expect(uri.startsWith('otpauth://totp/Somma%20Club%3Aana%40somma.run?')).toBe(true)
    const params = new URL(uri).searchParams
    expect(params.get('secret')).toBe('GEZDGNBVGY3TQOJQ')
    expect(params.get('issuer')).toBe('Somma Club')
    expect(params.get('digits')).toBe('6')
    expect(params.get('period')).toBe('30')
  })

  it('agrupa a chave de 4 em 4 para digitar', () => {
    expect(formatarSegredoParaDigitar('GEZDGNBVGY3TQOJQ')).toBe('GEZD GNBV GY3T QOJQ')
  })
})

describe('rotas públicas da segunda etapa', () => {
  it('setup e verify passam pelo middleware sem sessão, só via POST', () => {
    expect(isPublicApiRoute('/api/auth/mfa/setup', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/auth/mfa/verify', 'POST')).toBe(true)
    expect(isPublicApiRoute('/api/auth/mfa/verify', 'GET')).toBe(false)
    expect(isPublicApiRoute('/api/auth/mfa/outra', 'POST')).toBe(false)
  })

  it('redefinir 2FA de alguém exige admin', () => {
    expect(isPublicApiRoute('/api/admin/users/x/mfa', 'DELETE')).toBe(false)
    expect(getRequiredPermission('/api/admin/users/x/mfa')).toBe('admin')
  })
})
