/**
 * Tipos do módulo NPS Assessoria.
 *
 * As tabelas vivem no mesmo Supabase do site e foram criadas pelas migrations
 * do repositório do site (`supabase/migrations/2026091412…_assessoria_nps*.sql`):
 * o site grava as respostas, o painel cria as rodadas, lê os relatórios e
 * cuida das tratativas.
 */

export type StatusRodada = 'draft' | 'active' | 'closed'

export interface Rodada {
  id: string
  /** Código público do link: sommaclub.com.br/assessoria/nps/<slug>. */
  slug: string
  title: string
  survey_version: string
  /** `2026-B5` = set–out 2026. */
  reference_period: string
  status: StatusRodada
  opens_at: string | null
  closes_at: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
}

export interface ResumoRodada extends Rodada {
  total_responses: number
  promoters: number
  passives: number
  detractors: number
  nps: number | null
  avg_renewal_probability: number | null
  tratativas_pendentes: number
  convites: number
  convites_respondidos: number
}

export interface PontoHistorico {
  rodada_id: string
  slug: string
  rotulo: string
  opens_at: string | null
  total: number
  nps: number | null
}

export type CategoriaNps = 'promoter' | 'passive' | 'detractor'
export type MetodoIdentificacao = 'invite' | 'name_match' | 'self_declared'

/** Uma linha de `nps_assessoria_responses`. Nulo em pergunta condicional = não exibida. */
export interface RespostaNps {
  id: string
  campaign_id: string
  survey_version: string
  first_name: string
  last_name: string
  full_name: string
  identification_method: MetodoIdentificacao
  invite_id: string | null
  student_asaas_id: string | null
  professor_id: string | null
  professor_name: string | null

  nps_score: number
  nps_category: CategoriaNps
  nps_reason: string | null
  overall_quality: number
  expectation_delivery: number

  teacher_followup: number
  teacher_understands_goals: number
  teacher_whatsapp_access: number
  teacher_support_quality: number
  teacher_communication_quality: number

  training_quality: number
  training_level_fit: number
  training_goal_alignment: number
  perceived_progress: number
  needs_more_feedback: string

  whatsapp_group_quality: number
  whatsapp_connection: number
  whatsapp_message_volume: string
  whatsapp_information_clarity: number
  whatsapp_content_preferences: string[]
  whatsapp_content_other: string | null

  community_climate: number
  community_belonging: number
  community_interaction: number
  community_one_word: string | null

  sunday_frequency: string
  sunday_support_quality: number | null
  sunday_value: number | null
  sunday_improvements: string | null

  weekday_training_interest: string
  preferred_weekday_combination: string | null
  preferred_weekday_other: string | null
  preferred_period: string | null
  available_periods: string[] | null
  preferred_morning_time: string | null
  preferred_evening_time: string | null
  expected_weekly_frequency: string | null

  physical_structure_quality: number | null
  physical_structure_improvements: string | null

  cost_benefit: number
  renewal_probability: number

  what_is_excellent: string | null
  what_needs_improvement: string | null
  one_change: string | null

  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  device_type: string | null
  started_at: string
  submitted_at: string
  completion_seconds: number | null
}

export type StatusTratativa = 'pending' | 'in_progress' | 'resolved' | 'no_action'

export interface Tratativa {
  id: string
  response_id: string
  status: StatusTratativa
  owner_name: string | null
  resolved_at: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface EventoTratativa {
  id: string
  followup_id: string
  status: StatusTratativa | null
  note: string | null
  author: string
  created_at: string
}

/** Linha da lista de respostas: o essencial para escanear, sem as 40 colunas. */
export interface RespostaResumida {
  id: string
  full_name: string
  professor_name: string | null
  identification_method: MetodoIdentificacao
  source: string
  nps_score: number
  nps_category: CategoriaNps
  renewal_probability: number
  nps_reason: string | null
  submitted_at: string
  precisa_tratativa: boolean
  tratativa_status: StatusTratativa | null
  tratativa_responsavel: string | null
}

export interface ConviteNps {
  id: string
  student_asaas_id: string
  first_name: string
  last_name: string
  professor_name: string | null
  token: string
  opened_at: string | null
  shared_at: string | null
  created_at: string
  respondido: boolean
  telefone: string | null
}
