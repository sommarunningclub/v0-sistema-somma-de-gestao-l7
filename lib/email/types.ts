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

export type AudienceKey = 'membros' | 'checkins' | 'lista_vip' | 'lista_espera'

export interface AudienceSelection {
  bases: Array<{ key: AudienceKey; filtros: Record<string, string> }>
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
