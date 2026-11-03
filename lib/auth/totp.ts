import { createHmac, randomBytes } from 'crypto'

/**
 * TOTP (RFC 6238) — o código de 6 dígitos do Google Authenticator.
 *
 * Implementado aqui, sem biblioteca: são ~60 linhas de HMAC-SHA1 e base32, e
 * os vetores oficiais da RFC estão nos testes. Parâmetros fixos, os que o
 * Google Authenticator usa por padrão: SHA-1, 6 dígitos, passo de 30 s.
 *
 * Lógica pura, sem I/O.
 */

export const TOTP_DIGITOS = 6
export const TOTP_PASSO_S = 30
/**
 * Passos aceitos antes e depois do atual. 1 = ±30 s, o que cobre relógio de
 * celular um pouco adiantado ou atrasado sem abrir demais a janela.
 */
export const TOTP_JANELA = 1
export const TOTP_EMISSOR = 'Somma Club'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let valor = 0
  let saida = ''
  for (const byte of bytes) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      saida += BASE32[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) saida += BASE32[(valor << (5 - bits)) & 31]
  return saida
}

export function base32Decode(texto: string): Uint8Array {
  const limpo = texto.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let valor = 0
  const saida: number[] = []
  for (const c of limpo) {
    const indice = BASE32.indexOf(c)
    if (indice === -1) throw new Error('Segredo base32 inválido')
    valor = (valor << 5) | indice
    bits += 5
    if (bits >= 8) {
      saida.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Uint8Array.from(saida)
}

/** 160 bits, o tamanho recomendado pela RFC 4226 para HMAC-SHA1. */
export function gerarSegredoTotp(): string {
  return base32Encode(randomBytes(20))
}

export function passoAtual(agoraMs: number = Date.now()): number {
  return Math.floor(agoraMs / 1000 / TOTP_PASSO_S)
}

/** HOTP (RFC 4226) num passo. `digitos` só existe para os vetores de teste de 8 dígitos. */
export function codigoNoPasso(segredo: Uint8Array, passo: number, digitos: number = TOTP_DIGITOS): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(passo))
  const hmac = createHmac('sha1', Buffer.from(segredo)).update(contador).digest()
  const deslocamento = hmac[hmac.length - 1] & 0x0f
  const binario =
    ((hmac[deslocamento] & 0x7f) << 24) |
    (hmac[deslocamento + 1] << 16) |
    (hmac[deslocamento + 2] << 8) |
    hmac[deslocamento + 3]
  return String(binario % 10 ** digitos).padStart(digitos, '0')
}

/** Só dígitos: o app mostra "123 456", e muita gente digita com o espaço. */
export function normalizarCodigoTotp(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : ''
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i += 1) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

/**
 * Confere o código na janela de ±TOTP_JANELA passos e devolve o passo que
 * casou, ou null.
 *
 * `ultimoPassoUsado`: o passo do último código aceito para esta conta. Um
 * passo igual ou anterior é recusado — um código já usado (visto por cima do
 * ombro, ou capturado) não serve uma segunda vez.
 */
export function verificarTotp(
  segredoBase32: string,
  codigo: string,
  opcoes: { agoraMs?: number; ultimoPassoUsado?: number | null } = {},
): number | null {
  const normalizado = normalizarCodigoTotp(codigo)
  if (normalizado.length !== TOTP_DIGITOS) return null

  const segredo = base32Decode(segredoBase32)
  const atual = passoAtual(opcoes.agoraMs)
  const ultimo = opcoes.ultimoPassoUsado ?? -1

  let encontrado: number | null = null
  for (let delta = -TOTP_JANELA; delta <= TOTP_JANELA; delta += 1) {
    const passo = atual + delta
    // Sem `break`: o tempo não pode revelar em qual passo o código casou.
    if (iguaisEmTempoConstante(codigoNoPasso(segredo, passo), normalizado) && passo > ultimo) {
      encontrado = passo
    }
  }
  return encontrado
}

/** URI que o Google Authenticator lê no QR code. */
export function otpauthUri(conta: string, segredoBase32: string): string {
  const rotulo = encodeURIComponent(`${TOTP_EMISSOR}:${conta}`)
  const params = new URLSearchParams({
    secret: segredoBase32,
    issuer: TOTP_EMISSOR,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITOS),
    period: String(TOTP_PASSO_S),
  })
  return `otpauth://totp/${rotulo}?${params.toString()}`
}

/** "ABCD EFGH ..." — para digitar à mão quando a câmera não lê o QR. */
export function formatarSegredoParaDigitar(segredoBase32: string): string {
  return segredoBase32.replace(/(.{4})/g, '$1 ').trim()
}
