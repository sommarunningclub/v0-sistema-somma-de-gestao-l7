/**
 * Cupons do checkout da Assessoria.
 *
 * Quem consome é o sommaclub.com.br: o checkout procura o código na tabela
 * `coupons` ANTES da lista hardcoded dele (NOVO-SITE-SOMMA-V3,
 * lib/checkout/cupons.ts). Ou seja, salvar aqui publica na hora — não existe
 * deploy do site no meio do caminho. O contrário também vale: desativar um
 * cupom aqui derruba o desconto no próximo checkout.
 *
 * As regras abaixo espelham exatamente o que o site sabe aplicar. Não adianta
 * inventar campo novo nesta tela: se o checkout não lê, a regra não existe.
 */

export const TABELA_CUPONS = 'coupons'

export type TipoCupom = 'PERCENTAGE' | 'FIXED'
export type StatusCupom = 'ACTIVE' | 'EXPIRED' | 'DISABLED'
export type TipoPlano = 'recurring' | 'installment'

export interface Cupom {
  id: string
  code: string
  type: TipoCupom
  value: number
  description: string | null
  expiration_date: string | null
  usage_limit: number | null
  usage_count: number
  status: StatusCupom
  professor: string | null
  plan_type: TipoPlano | null
  first_month_only: boolean
  created_at: string
  updated_at: string
}

/** Colunas devolvidas ao painel — `select *` traria as colunas mortas. */
export const CAMPOS_CUPOM =
  'id, code, type, value, description, expiration_date, usage_limit, usage_count, status, professor, plan_type, first_month_only, created_at, updated_at'

/**
 * Nomes canônicos dos professores, iguais aos do GROUP_MAP do site
 * (lib/asaas/groups.ts). A comparação lá é por igualdade exata do nome
 * escolhido no checkout, então uma grafia diferente aqui vira um cupom que
 * nunca casa — e o cliente só descobre no meio da compra.
 */
export const PROFESSORES = ['Alexandre Alves', 'Joseph Pereira', 'Mateus Fonseca'] as const

export const PLANOS: Array<{ valor: TipoPlano; rotulo: string; detalhe: string }> = [
  { valor: 'recurring', rotulo: 'Mensal', detalhe: 'assinatura recorrente no cartão' },
  { valor: 'installment', rotulo: 'Semestral e Anual', detalhe: 'cobrança parcelada' },
]

export interface EntradaCupom {
  code: string
  type: TipoCupom
  value: number
  description: string | null
  expiration_date: string | null
  usage_limit: number | null
  status: Exclude<StatusCupom, 'EXPIRED'>
  professor: string | null
  plan_type: TipoPlano | null
  first_month_only: boolean
}

export function normalizarCodigo(valor: unknown): string {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim()
}

const CODIGO_VALIDO = /^[A-Z0-9][A-Z0-9_-]{2,29}$/

/**
 * Valida o que virou payload de criação/edição.
 *
 * Roda no servidor porque é ele que grava, e um cupom mal formado não é um
 * erro de tela: é desconto errado aplicado em cobrança real.
 */
export function validarEntrada(bruto: unknown): { ok: true; entrada: EntradaCupom } | { ok: false; erro: string } {
  if (!bruto || typeof bruto !== 'object') return { ok: false, erro: 'Corpo da requisição inválido' }
  const body = bruto as Record<string, unknown>

  const code = normalizarCodigo(body.code)
  if (!code) return { ok: false, erro: 'Informe o código do cupom' }
  if (!CODIGO_VALIDO.test(code)) {
    return {
      ok: false,
      erro: 'Código deve ter de 3 a 30 caracteres, usando apenas letras, números, hífen ou underline',
    }
  }

  const type = body.type === 'FIXED' ? 'FIXED' : body.type === 'PERCENTAGE' ? 'PERCENTAGE' : null
  if (!type) return { ok: false, erro: 'Escolha se o desconto é percentual ou em reais' }

  const value = Number(body.value)
  if (!Number.isFinite(value) || value <= 0) return { ok: false, erro: 'O valor do desconto precisa ser maior que zero' }
  if (type === 'PERCENTAGE' && value > 100) return { ok: false, erro: 'Desconto percentual não pode passar de 100%' }
  // Duas casas: o desconto vira valor de cobrança no Asaas.
  const valueArredondado = Math.round(value * 100) / 100

  let expiration_date: string | null = null
  if (body.expiration_date) {
    const bruta = String(body.expiration_date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bruta) || Number.isNaN(new Date(`${bruta}T00:00:00`).getTime())) {
      return { ok: false, erro: 'Data de validade inválida' }
    }
    expiration_date = bruta
  }

  let usage_limit: number | null = null
  if (body.usage_limit !== null && body.usage_limit !== undefined && body.usage_limit !== '') {
    const limite = Number(body.usage_limit)
    if (!Number.isInteger(limite) || limite < 1) {
      return { ok: false, erro: 'O limite de uso precisa ser um número inteiro a partir de 1' }
    }
    usage_limit = limite
  }

  let professor: string | null = null
  if (body.professor) {
    const escolhido = String(body.professor)
    if (!PROFESSORES.includes(escolhido as (typeof PROFESSORES)[number])) {
      return { ok: false, erro: 'Professor não reconhecido pelo checkout' }
    }
    professor = escolhido
  }

  let plan_type: TipoPlano | null = null
  if (body.plan_type) {
    if (body.plan_type !== 'recurring' && body.plan_type !== 'installment') {
      return { ok: false, erro: 'Tipo de plano inválido' }
    }
    plan_type = body.plan_type
  }

  const first_month_only = body.first_month_only === true
  // O site só honra `firstMonthOnly` em plano recorrente. Combinado com o
  // parcelado, seria uma regra que a tela promete e a cobrança ignora.
  if (first_month_only && plan_type === 'installment') {
    return { ok: false, erro: 'Desconto só na 1ª mensalidade não se aplica a plano parcelado' }
  }

  const status = body.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'

  const descricaoBruta = typeof body.description === 'string' ? body.description.trim() : ''

  return {
    ok: true,
    entrada: {
      code,
      type,
      value: valueArredondado,
      description: descricaoBruta ? descricaoBruta.slice(0, 200) : null,
      expiration_date,
      usage_limit,
      status,
      professor,
      plan_type,
      first_month_only,
    },
  }
}

/** Texto curto do desconto, no mesmo formato que o checkout mostra ao cliente. */
export function descreverDesconto(cupom: Pick<Cupom, 'type' | 'value'>): string {
  return cupom.type === 'PERCENTAGE'
    ? `${cupom.value}% de desconto`
    : `R$ ${cupom.value.toFixed(2).replace('.', ',')} de desconto`
}

/**
 * Situação real do cupom, que nem sempre é a coluna `status`: um cupom ACTIVE
 * com validade vencida ou limite estourado já não passa no checkout. A tela
 * mostra o que o cliente encontraria, não o que está gravado.
 */
export function situacaoDoCupom(cupom: Cupom): {
  estado: 'ativo' | 'desativado' | 'expirado' | 'esgotado'
  rotulo: string
} {
  if (cupom.status === 'DISABLED') return { estado: 'desativado', rotulo: 'Desativado' }
  if (cupom.expiration_date && new Date(`${cupom.expiration_date}T23:59:59`) < new Date()) {
    return { estado: 'expirado', rotulo: 'Expirado' }
  }
  if (cupom.status === 'EXPIRED') return { estado: 'expirado', rotulo: 'Expirado' }
  if (cupom.usage_limit !== null && cupom.usage_count >= cupom.usage_limit) {
    return { estado: 'esgotado', rotulo: 'Esgotado' }
  }
  return { estado: 'ativo', rotulo: 'Ativo' }
}

/** Resumo das restrições, para a linha da listagem. */
export function descreverRegras(cupom: Cupom): string[] {
  const regras: string[] = []
  if (cupom.professor) regras.push(`Só com ${cupom.professor}`)
  if (cupom.plan_type) {
    regras.push(cupom.plan_type === 'recurring' ? 'Só no plano Mensal' : 'Só em Semestral e Anual')
  }
  if (cupom.first_month_only) regras.push('Só na 1ª mensalidade')
  if (cupom.usage_limit !== null) regras.push(`${cupom.usage_count}/${cupom.usage_limit} usos`)
  if (cupom.expiration_date) {
    const [ano, mes, dia] = cupom.expiration_date.split('-')
    regras.push(`Até ${dia}/${mes}/${ano}`)
  }
  return regras
}
