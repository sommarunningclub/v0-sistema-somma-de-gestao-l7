import { randomInt } from 'crypto'

/**
 * Código de login por e-mail do Insider.
 *
 * Lógica pura, sem I/O, para poder ser testada sem banco nem Resend.
 */

/** Validade curta: o código é o que autentica, e ele viaja por e-mail. */
export const CODIGO_TTL_MS = 10 * 60 * 1000

/**
 * Teto de tentativas por código. Com 6 dígitos são 1.000.000 de
 * combinações; 5 palpites deixam a chance de acerto em 1 em 200.000 por
 * código emitido, e o pedido de um novo código invalida o anterior.
 */
export const MAX_TENTATIVAS = 5

export const CODIGO_TAMANHO = 6

/**
 * 6 dígitos com aleatoriedade criptográfica e distribuição uniforme.
 * `randomInt` com limite superior descarta valores enviesados internamente —
 * `Math.random()` ou `% 1000000` não serviriam aqui.
 */
export function gerarCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODIGO_TAMANHO, '0')
}

/** Só dígitos; o usuário costuma colar com espaço ou hífen. */
export function normalizarCodigo(valor: unknown): string {
  return typeof valor === 'string' ? valor.replace(/\D/g, '') : ''
}

export function formatoValido(codigo: string): boolean {
  return new RegExp(`^\\d{${CODIGO_TAMANHO}}$`).test(codigo)
}

export function expiraEm(agora: number = Date.now()): Date {
  return new Date(agora + CODIGO_TTL_MS)
}

/**
 * Mostra o domínio e a primeira letra: o insider precisa saber em qual caixa
 * procurar, mas a rota é pública e não pode entregar o e-mail de ninguém a
 * quem só digitou um CPF.
 *
 *   alexandre@gmail.com -> a********@gmail.com
 */
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf('@')
  if (arroba <= 0) return '***'

  const usuario = email.slice(0, arroba)
  const dominio = email.slice(arroba)
  if (usuario.length === 1) return `*${dominio}`

  return `${usuario[0]}${'*'.repeat(usuario.length - 1)}${dominio}`
}
