/** Meta de insiders corredores por pelotão. É alvo visual, nunca trava. */
export const META_POR_PELOTAO = 2

export const ESCALA_STATUS = ['corre', 'apoio', 'nao_vai'] as const
export type EscalaStatus = (typeof ESCALA_STATUS)[number]

export const ESCALA_STATUS_LABELS: Record<EscalaStatus, string> = {
  corre: 'Corre',
  apoio: 'Apoio (não corre)',
  nao_vai: 'Não vai',
}

export const ATIVIDADE_COR_PADRAO = '#F97316'

export const ATIVIDADE_CORES = [
  '#F97316', '#22C55E', '#3B82F6', '#A855F7',
  '#EAB308', '#EC4899', '#14B8A6', '#EF4444',
] as const
