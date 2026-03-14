export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_evento: string
  horario_inicio: string
  local: string
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
  checkin_abertura?: string
  checkin_fechamento?: string
  checkin_status?: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes?: string[]
}

export interface EventoUpdate extends Partial<EventoCreate> {}

export interface EventoWithStats extends Evento {
  checkin_count: number
}
