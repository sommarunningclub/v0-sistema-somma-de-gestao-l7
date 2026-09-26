import { isValidCpf, maskCpf, onlyDigits } from '@/lib/insider/validation'

/**
 * Operadores da frente de caixa (SOMMA PDV Point).
 *
 * Lógica pura, sem I/O: serve ao formulário do painel e às rotas, e é
 * espelhada em `src/lib/operator-code.ts` do somma-pdv-point, que é quem
 * valida o login. Domínio do e-mail sintético e normalização do código
 * PRECISAM ser iguais dos dois lados — o Supabase Auth compara a senha
 * byte a byte, e o e-mail é a chave do usuário.
 *
 * Como funciona: cada operador é um usuário do Supabase Auth cujo e-mail é
 * derivado do CPF e cuja senha é o código gerado aqui. A autorização é a
 * mesma que o PDV já usa (`admin_roles`, papel `operator`).
 */

export const OPERADOR_EMAIL_DOMINIO = 'pdv.sommaclub.com.br'

/**
 * 8 posições de um alfabeto sem I, O, 0 e 1 (ninguém confunde ao ditar):
 * 32^8 ≈ 1,1 trilhão de combinações. É a senha do operador, e o login do PDV
 * é público — 6 dígitos, como no código por e-mail do Insider, seriam pouco.
 */
export const CODIGO_ACESSO_TAMANHO = 8
export const CODIGO_ACESSO_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export type Operador = {
  id: string
  /** 11 dígitos, sem máscara. */
  cpf: string
  nome: string
  ativo: boolean
  /**
   * SOMMA Insider com senha cadastrada: entra no PDV com a senha do Insider
   * Connect, sem precisar de código. Calculado na listagem, não gravado —
   * quem virar Insider depois passa a poder entrar assim automaticamente.
   */
  insider: boolean
  /** Quando o código vigente foi gerado. */
  codigo_gerado_em: string
  /** `last_sign_in_at` do Auth; null se nunca entrou. */
  ultimo_acesso_em: string | null
  criado_em: string
  criado_por: string | null
}

/** E-mail sintético que identifica o operador no Supabase Auth. */
export function emailDoOperador(cpf: string): string {
  return `${onlyDigits(cpf)}@${OPERADOR_EMAIL_DOMINIO}`
}

/** Maiúsculas e só letras/dígitos: o operador cola com hífen ou digita minúsculo. */
export function normalizarCodigoAcesso(valor: unknown): string {
  return typeof valor === 'string' ? valor.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
}

export function formatoCodigoValido(codigo: string): boolean {
  if (codigo.length !== CODIGO_ACESSO_TAMANHO) return false
  return [...codigo].every((c) => CODIGO_ACESSO_ALFABETO.includes(c))
}

/** XXXX-XXXX, para ler e ditar. */
export function formatarCodigoAcesso(codigo: string): string {
  const c = normalizarCodigoAcesso(codigo)
  return c.length === CODIGO_ACESSO_TAMANHO ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export function formatarCpfOperador(cpf: string): string {
  return maskCpf(cpf)
}

/**
 * `senhaInsider`: liberar a entrada com a senha do Insider Connect, se o CPF
 * for Insider com senha. Default true; desligado, o painel gera código mesmo
 * para Insider (útil quando o registro Insider não é conhecido de quem libera).
 */
export type NovoOperador = { cpf: string; nome: string | null; senhaInsider: boolean }

export function validarNovoOperador(
  body: unknown
): { ok: true; entrada: NovoOperador } | { ok: false; erro: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  const cpf = typeof b.cpf === 'string' ? onlyDigits(b.cpf) : ''
  if (!isValidCpf(cpf)) return { ok: false, erro: 'CPF inválido.' }

  const nome = typeof b.nome === 'string' ? b.nome.trim().replace(/\s+/g, ' ') : ''
  if (nome.length > 120) return { ok: false, erro: 'Nome muito longo.' }
  if (nome && nome.length < 2) return { ok: false, erro: 'Informe o nome do operador.' }

  // Nome em branco não é erro: a rota tenta preencher pela base de membros.
  return { ok: true, entrada: { cpf, nome: nome || null, senhaInsider: b.senha_insider !== false } }
}

/** Texto pronto para mandar no WhatsApp de quem vai operar o caixa. */
export function instrucoesDeAcesso(p: {
  nome: string
  cpf: string
  codigo: string
  loginUrl: string
}): string {
  return [
    'Acesso à frente de caixa SOMMA',
    '',
    `Operador: ${p.nome}`,
    `Entre em: ${p.loginUrl}`,
    `CPF: ${maskCpf(p.cpf)}`,
    `Código de acesso: ${formatarCodigoAcesso(p.codigo)}`,
    '',
    'O código é pessoal. Se perder, peça um novo no painel.',
  ].join('\n')
}

/** Versão para quem é Insider: nenhum código, a senha é a do Insider Connect. */
export function instrucoesDeAcessoInsider(p: { nome: string; cpf: string; loginUrl: string }): string {
  return [
    'Acesso à frente de caixa SOMMA',
    '',
    `Operador: ${p.nome}`,
    `Entre em: ${p.loginUrl}`,
    `CPF: ${maskCpf(p.cpf)}`,
    'Senha: a mesma do Insider Connect (sommaclub.com.br/insider-conect)',
    '',
    'Na tela de login, toque em "Senha do Insider" antes de digitar a senha.',
  ].join('\n')
}
