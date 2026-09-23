export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_evento: string
  horario_inicio: string
  local: string
  local_url: string | null
  /** Quando preenchido, o /check-in público manda para a LP em vez de abrir o wizard. */
  lp_url: string | null
  tipo: 'corrida' | 'personalizado'
  checkin_abertura: string | null
  checkin_fechamento: string | null
  checkin_status: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes: string[]
  created_at: string
  updated_at: string
  criado_por: string | null
}

export interface EventoCreate {
  titulo: string
  descricao?: string
  data_evento: string
  horario_inicio?: string
  local?: string
  local_url?: string
  lp_url?: string
  tipo?: 'corrida' | 'personalizado'
  checkin_abertura?: string
  checkin_fechamento?: string
  checkin_status?: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes?: string[]
}

export interface EventoUpdate extends Partial<EventoCreate> {}

export interface EventoWithStats extends Evento {
  /** Pessoas no evento: linhas em `checkins` + inscritos pela LP que ainda não estão lá. */
  checkin_count: number
  /** Inscritos pela LP do site que ainda não foram copiados para `checkins`. */
  inscritos_lp_fora?: number
}
