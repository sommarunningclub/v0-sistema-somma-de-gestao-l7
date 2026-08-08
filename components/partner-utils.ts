import type { StatusTone } from '@/components/somma'
import type { Partner } from '@/lib/services/partners'

/** Status possíveis de uma parceria. */
export type PartnerStatus = NonNullable<Partner['status']>

/** Tipos de benefício oferecidos por um parceiro. */
export type PartnerBenefitType = NonNullable<Partner['benefit_type']>

export const PARTNER_STATUS_ORDER: PartnerStatus[] = [
  'active',
  'negotiating',
  'pending',
  'inactive',
]

export const PARTNER_STATUS_LABEL: Record<PartnerStatus, string> = {
  active: 'Ativo',
  pending: 'Pendente',
  negotiating: 'Em negociação',
  inactive: 'Inativo',
}

const PARTNER_STATUS_TONE: Record<PartnerStatus, StatusTone> = {
  active: 'success',
  pending: 'warning',
  negotiating: 'info',
  inactive: 'danger',
}

export function partnerStatusLabel(status: Partner['status']): string {
  return PARTNER_STATUS_LABEL[status ?? 'pending'] ?? 'Pendente'
}

export function partnerStatusTone(status: Partner['status']): StatusTone {
  return PARTNER_STATUS_TONE[status ?? 'pending'] ?? 'neutral'
}

export const PARTNER_BENEFIT_LABEL: Record<PartnerBenefitType, string> = {
  percentage: 'Desconto %',
  fixed: 'Valor fixo',
  service: 'Serviço',
  other: 'Outro',
}

export function partnerBenefitLabel(type: Partner['benefit_type']): string {
  return PARTNER_BENEFIT_LABEL[type ?? 'other'] ?? 'Outro'
}

/** Formata um CNPJ para 00.000.000/0000-00; devolve a entrada se incompleto. */
export function formatCNPJ(cnpj: string): string {
  const clean = (cnpj ?? '').replace(/\D/g, '')
  if (clean.length !== 14) return cnpj
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`
}
