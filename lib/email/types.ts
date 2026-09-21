import type { TemplateKey, TemplateFields } from './templates'

export type CampaignStatus =
  | 'rascunho'
  | 'agendada'
  | 'enviando'
  | 'enviada'
  | 'cancelada'
  | 'erro'

export type RecipientStatus =
  | 'pendente'
  | 'enviado'
  | 'entregue'
  | 'aberto'
  | 'clicado'
  | 'bounce'
  | 'spam'
  | 'falha'

export type AudienceKey =
  | 'membros'
  | 'checkins'
  | 'lista_vip'
  | 'lista_espera'
  | 'sunset_wine_run'
  | 'talk_run'

export interface AudienceIndividual {
  email: string
  nome: string | null
}

export interface AudienceSelection {
  bases: Array<{ key: AudienceKey; filtros: Record<string, string> }>
  /** Destinatários avulsos, buscados na base de membros ou digitados. */
  individuais?: AudienceIndividual[]
  /**
   * Campanhas cujos abridores ficam de fora desta. É o que sustenta uma régua
   * de reenvio: a etapa 2 aponta para a etapa 1, a etapa 3 para as duas
   * anteriores, e assim por diante.
   *
   * A exclusão é resolvida na hora do disparo (`prepareCampaign`), não na hora
   * de agendar. Isso permite agendar a régua inteira de uma vez: cada etapa
   * enxerga as aberturas acumuladas até o próprio horário.
   */
  excluir_abertos_de?: string[]
}

export interface EmailCampaign {
  id: string
  nome: string
  status: CampaignStatus
  template_key: TemplateKey
  subject: string
  preheader: string | null
  content: TemplateFields
  cta_label: string | null
  cta_url: string | null
  audience: AudienceSelection
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  total_recipients: number
  error: string | null
  created_by: string | null
  /** Fora da listagem padrão, sem deixar de ser o que é. NULL = ativa. */
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignStats {
  total: number
  pendente: number
  enviado: number
  entregue: number
  aberto: number
  clicado: number
  bounce: number
  spam: number
  falha: number
  descadastros: number
}
