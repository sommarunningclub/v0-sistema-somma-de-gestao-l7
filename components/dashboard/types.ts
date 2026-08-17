/**
 * Contrato dos blocos novos do Dashboard.
 *
 * Vive fora da rota para que o endpoint (`app/api/command-center/metrics`) e a
 * página (`app/command-center`) compartilhem a MESMA definição — dois tipos
 * paralelos divergem silenciosamente na primeira mudança de campo.
 *
 * Convenção do painel: `null` no lugar de um bloco significa "não foi possível
 * apurar", nunca "zero". Um bloco presente com lista vazia significa "apurado,
 * e não há nada ainda" — que é uma informação diferente.
 */

export interface MembroCheckins {
  cpf: string
  nome: string
  validados: number
}

export interface DashboardTopCheckinsBloco {
  /** Membro com mais check-ins validados. `null` quando ninguém tem validação. */
  destaque: MembroCheckins | null
  /** Os 4 seguintes do ranking. */
  seguintes: MembroCheckins[]
  /** `true` quando o teto de leitura foi atingido e o ranking pode estar incompleto. */
  parcial: boolean
}

export interface MembroPresenca {
  cpf: string
  nome: string
  /** Eventos distintos em que o membro tem check-in registrado. */
  eventos: number
}

export interface DashboardPresencaBloco {
  /** Eventos distintos que já tiveram ao menos um check-in — o denominador. */
  totalEventos: number
  membros: MembroPresenca[]
  parcial: boolean
}

export interface InsiderPresenca {
  id: string
  nome: string
  /** Eventos distintos em que o insider tem check-in registrado. */
  eventos: number
}

export interface DashboardPresencaInsidersBloco {
  /** Mesmo denominador do ranking de membros: eventos que já tiveram check-in. */
  totalEventos: number
  insiders: InsiderPresenca[]
  parcial: boolean
}

export type EscalaStatus = 'corre' | 'apoio' | 'nao_vai'

export interface EscalaInsiderResumo {
  id: string
  nome: string
  status: EscalaStatus
  pelotao: string | null
  atividades: string[]
}

export interface DashboardEscalaBloco {
  /** `null` quando nenhum evento tem escala montada. */
  evento: {
    id: string
    titulo: string
    dataEvento: string
    horarioInicio: string | null
    local: string | null
    /** `true` quando a escala exibida é do evento mais recente já realizado. */
    passado: boolean
  } | null
  insiders: EscalaInsiderResumo[]
}

export interface EventoProximo {
  id: string
  titulo: string
  dataEvento: string
  horarioInicio: string | null
  local: string | null
  checkinStatus: string | null
  /** `null` quando a contagem de inscritos daquele evento falhou. */
  inscritos: number | null
}

export interface DashboardProximosEventosBloco {
  eventos: EventoProximo[]
}

export interface DashboardBlocos {
  topCheckins: DashboardTopCheckinsBloco | null
  presencaEventos: DashboardPresencaBloco | null
  presencaInsiders: DashboardPresencaInsidersBloco | null
  escalaInsiders: DashboardEscalaBloco | null
  proximosEventos: DashboardProximosEventosBloco | null
}

export const ESCALA_STATUS_LABEL: Record<EscalaStatus, string> = {
  corre: 'Corre',
  apoio: 'Apoio',
  nao_vai: 'Não vai',
}

export const CHECKIN_STATUS_LABEL: Record<string, string> = {
  aberto: 'Check-in aberto',
  bloqueado: 'Check-in bloqueado',
  encerrado: 'Check-in encerrado',
}
