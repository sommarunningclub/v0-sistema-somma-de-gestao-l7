import type { CampaignStatus, EmailCampaign } from './types'

/**
 * Regras de arquivamento das campanhas.
 *
 * Arquivar é sobre tirar da frente o que já terminou, não sobre interromper o
 * que está em curso. Por isso só campanhas em estado terminal podem ir para o
 * arquivo: uma `agendada` que sumisse da listagem dispararia sozinha, dias
 * depois, sem ninguém lembrar dela — e uma `enviando` está com o cron em cima
 * dela agora. `rascunho` fica de fora porque é trabalho em aberto: é o que a
 * pessoa está montando, não histórico.
 */
export const STATUS_ARQUIVAVEIS: readonly CampaignStatus[] = ['enviada', 'cancelada', 'erro']

export function podeArquivar(status: CampaignStatus): boolean {
  return STATUS_ARQUIVAVEIS.includes(status)
}

/** Motivo da recusa, no texto que a tela e a API mostram. */
export function motivoNaoArquivavel(status: CampaignStatus): string {
  if (status === 'enviando') {
    return 'Campanha em envio não pode ser arquivada. Aguarde terminar ou cancele.'
  }
  if (status === 'agendada') {
    return 'Campanha agendada não pode ser arquivada — ela ainda vai disparar. Cancele antes.'
  }
  return 'Só campanhas enviadas, canceladas ou com erro podem ser arquivadas.'
}

export function estaArquivada(campanha: Pick<EmailCampaign, 'archived_at'>): boolean {
  return campanha.archived_at !== null && campanha.archived_at !== undefined
}
