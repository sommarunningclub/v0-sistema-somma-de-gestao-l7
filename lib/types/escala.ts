import type { EscalaStatus } from '@/lib/escala-constants'

export type EstadoPreenchimento = 'completo' | 'parcial' | 'vazio'

export interface EscalaAtividade {
  id: string
  nome: string
  descricao: string | null
  cor: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EscalaInsider {
  id: string
  evento_id: string
  insider_id: string
  insider_nome: string
  status: EscalaStatus
  pelotao: string | null
  motivo: string | null
  observacao: string | null
  atividades: EscalaAtividade[]
}

export interface EscalaInsiderInput {
  insider_id: string
  status: EscalaStatus
  pelotao?: string | null
  motivo?: string | null
  observacao?: string | null
  atividade_ids?: string[]
}

export interface PelotaoResumo {
  pelotao: string
  escalados: number
  meta: number
  estado: EstadoPreenchimento
}

export interface EscalaDiaResumo {
  evento_id: string
  titulo: string
  data_evento: string
  horario_inicio: string
  tipo: 'corrida' | 'personalizado'
  pelotoes: string[]
  pelotoes_resumo: PelotaoResumo[]
  corredores: number
  meta_total: number
  apoio: number
  nao_vai: number
  estado: EstadoPreenchimento
}

export interface EscalaDia extends EscalaDiaResumo {
  insiders: EscalaInsider[]
}

export interface InsiderOption {
  id: string
  nome: string
}

export interface CelulaCalendario {
  /** 'YYYY-MM-DD' */
  data: string
  dia: number
  /** false para os dias de preenchimento do mês anterior/seguinte */
  no_mes: boolean
}
