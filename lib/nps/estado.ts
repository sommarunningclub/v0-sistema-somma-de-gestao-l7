import type { Rodada } from './tipos'

/**
 * Estado que a tela mostra, derivado do status gravado e da janela.
 *
 * O banco só guarda rascunho / publicada / encerrada. "Agendada" e "No ar" são
 * a mesma rodada publicada antes e depois da abertura: calcular aqui evita um
 * cron para virar status, e o site faz exatamente a mesma conta.
 */
export type EstadoRodada = 'rascunho' | 'agendada' | 'no_ar' | 'encerrada'

export function estadoDaRodada(
  rodada: Pick<Rodada, 'status' | 'opens_at' | 'closes_at'>,
  agora: Date = new Date(),
): EstadoRodada {
  if (rodada.status === 'draft') return 'rascunho'
  if (rodada.status === 'closed') return 'encerrada'
  if (rodada.opens_at && new Date(rodada.opens_at) > agora) return 'agendada'
  if (rodada.closes_at && new Date(rodada.closes_at) <= agora) return 'encerrada'
  return 'no_ar'
}

export const ESTADOS: Record<EstadoRodada, { rotulo: string; tone: 'neutral' | 'info' | 'success' }> = {
  rascunho: { rotulo: 'Rascunho', tone: 'neutral' },
  agendada: { rotulo: 'Agendada', tone: 'info' },
  no_ar: { rotulo: 'No ar', tone: 'success' },
  encerrada: { rotulo: 'Encerrada', tone: 'neutral' },
}

export const STATUS_TRATATIVA: Record<
  'pending' | 'in_progress' | 'resolved' | 'no_action',
  { rotulo: string; tone: 'danger' | 'warning' | 'success' | 'neutral' }
> = {
  pending: { rotulo: 'Pendente', tone: 'danger' },
  in_progress: { rotulo: 'Em contato', tone: 'warning' },
  resolved: { rotulo: 'Resolvida', tone: 'success' },
  no_action: { rotulo: 'Sem ação', tone: 'neutral' },
}
