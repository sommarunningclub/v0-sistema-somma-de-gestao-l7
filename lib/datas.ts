/**
 * Datas e horas do painel, sempre no fuso de Brasília.
 *
 * O servidor da Vercel roda em UTC. Um `toLocaleString('pt-BR')` sem `timeZone`
 * usa o fuso de quem está formatando — então uma data formatada no servidor
 * saía três horas adiantada, e um check-in das 16:13 aparecia como 19:13 na
 * tela. O valor no banco sempre esteve certo; o que mentia era a formatação.
 *
 * Todo mundo aqui é `Intl.DateTimeFormat` criado uma vez, não `toLocaleString`
 * por linha: a lista de check-in formata centenas de registros por render.
 */

export const FUSO_BRASILIA = 'America/Sao_Paulo'

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_BRASILIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const HORA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_BRASILIA,
  hour: '2-digit',
  minute: '2-digit',
})

const DATA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO_BRASILIA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** `2026-09-24T19:13:14+00:00` → `24/09/2026, 16:13` */
export function formatarDataHoraBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : DATA_HORA.format(d)
}

/** `2026-09-24T19:13:14+00:00` → `16:13` */
export function formatarHoraBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : HORA.format(d)
}

/** Instante (timestamptz) → `24/09/2026`, no dia de calendário de Brasília. */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : DATA.format(d)
}

/**
 * Coluna `date` do Postgres (`2026-09-26`) → `26/09/2026`.
 *
 * Sem passar por `Date` de propósito. Uma data pura não tem hora nem fuso, mas
 * `new Date('2026-09-26')` vira meia-noite UTC — e formatar isso em Brasília
 * devolveria 25/09. Hoje isso não aparece porque o servidor roda em UTC; seria
 * um erro de um dia esperando a primeira mudança de runtime.
 */
export function formatarDataPura(valor: string | null | undefined): string {
  if (!valor) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (!m) return ''
  const [, ano, mes, dia] = m
  return `${dia}/${mes}/${ano}`
}
