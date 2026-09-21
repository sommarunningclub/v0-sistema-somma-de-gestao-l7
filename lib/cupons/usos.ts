/**
 * Usos de cupom: quem usou, quando, em que plano, com que professor.
 *
 * Quem grava é o checkout do site (NOVO-SITE-SOMMA-V3,
 * app/api/asaas/subscription/route.ts) via `register_coupon_redemption`, na
 * hora em que a cobrança nasce no Asaas. O trigger da tabela soma 1 em
 * `coupons.usage_count`, então o contador do card e esta lista nunca divergem.
 *
 * As linhas com `source = 'asaas'` vieram da importação do histórico
 * (descrição das cobranças no Asaas, "... | Cupom: JO130") feita em 21/09/2026,
 * antes de o site gravar aqui. Elas não têm desconto exato nem e-mail garantido.
 */

export const TABELA_USOS = 'coupon_redemptions'

export type BillingUso = 'recurring' | 'installment' | 'pix'

export interface UsoCupom {
  id: string
  coupon_code: string | null
  customer_name: string | null
  customer_email: string | null
  plano: string | null
  professor: string | null
  billing: BillingUso | null
  discount_applied: number | null
  source: 'checkout' | 'asaas'
  asaas_status: string | null
  asaas_customer_id: string | null
  asaas_payment_id: string | null
  asaas_subscription_id: string | null
  redeemed_at: string
}

export const CAMPOS_USO =
  'id, coupon_code, customer_name, customer_email, plano, professor, billing, discount_applied, source, asaas_status, asaas_customer_id, asaas_payment_id, asaas_subscription_id, redeemed_at'

const BILLING: Record<BillingUso, string> = {
  recurring: 'Mensal no cartão',
  installment: 'Parcelado no cartão',
  pix: 'PIX à vista',
}

export function descreverCobranca(uso: Pick<UsoCupom, 'billing' | 'plano'>): string {
  const forma = uso.billing ? BILLING[uso.billing] : null
  if (uso.plano && forma) return `${uso.plano} · ${forma}`
  return uso.plano ?? forma ?? '-'
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function descreverAbatimento(uso: Pick<UsoCupom, 'discount_applied'>): string | null {
  if (uso.discount_applied === null || uso.discount_applied === undefined) return null
  const valor = Number(uso.discount_applied)
  if (!Number.isFinite(valor) || valor <= 0) return null
  return `${MOEDA.format(valor)} de desconto`
}

/**
 * Compra estornada ou cancelada no Asaas continua contando como uso (o cupom
 * foi gasto), mas a tela avisa para ninguém achar que virou aluno.
 */
export function situacaoDoUso(uso: Pick<UsoCupom, 'asaas_status'>): {
  rotulo: string
  tone: 'success' | 'warning' | 'neutral'
} | null {
  switch (uso.asaas_status) {
    case null:
    case undefined:
      return null
    case 'ACTIVE':
    case 'RECEIVED':
    case 'CONFIRMED':
      return { rotulo: 'Pago', tone: 'success' }
    case 'REFUNDED':
      return { rotulo: 'Estornado', tone: 'warning' }
    case 'INACTIVE':
    case 'EXPIRED':
      return { rotulo: 'Cancelado', tone: 'neutral' }
    default:
      return { rotulo: uso.asaas_status, tone: 'neutral' }
  }
}
