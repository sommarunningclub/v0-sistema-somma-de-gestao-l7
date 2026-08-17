import type { EscalaStatus } from '@/lib/escala-constants'

/** Na escala, presença é quem correu ou apoiou — "não vai" é ausência. */
export const STATUS_PRESENCA_ESCALA = ['corre', 'apoio'] as const

export interface EscalaPresencaRow {
  insider_id: string
  evento_id: string
  status: EscalaStatus
  nome: string | null
}

export interface InsiderCadastro {
  id: string
  nome: string | null
}

export interface EventoRealizado {
  id: string
  data_evento: string
}

export interface InsiderPresencaRank {
  id: string
  nome: string
  eventos: number
}

export interface PresencaInsidersMes {
  /** `YYYY-MM` */
  mes: string
  totalEventos: number
  insiders: InsiderPresencaRank[]
}

export interface AgregadoPresencaInsiders {
  meses: PresencaInsidersMes[]
  todos: {
    totalEventos: number
    insiders: InsiderPresencaRank[]
  }
}

function estevePresente(status: EscalaStatus): boolean {
  return (STATUS_PRESENCA_ESCALA as readonly string[]).includes(status)
}

/** Extrai `YYYY-MM` de `data_evento` (`YYYY-MM-DD`). */
export function chaveMes(dataEvento: string): string | null {
  const chave = dataEvento.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(chave) ? chave : null
}

function contarNoPeriodo(
  presentes: ReadonlySet<string> | undefined,
  periodo: ReadonlySet<string>
): number {
  if (!presentes || periodo.size === 0) return 0
  let total = 0
  for (const eventoId of presentes) {
    if (periodo.has(eventoId)) total += 1
  }
  return total
}

function montarRanking(
  ids: string[],
  nomes: Map<string, string>,
  presentes: Map<string, Set<string>>,
  eventosDoPeriodo: ReadonlySet<string>
): InsiderPresencaRank[] {
  return ids
    .map((id) => ({
      id,
      nome: nomes.get(id)?.trim() || 'Insider sem nome',
      eventos: contarNoPeriodo(presentes.get(id), eventosDoPeriodo),
    }))
    .sort(
      (a, b) =>
        b.eventos - a.eventos || a.nome.localeCompare(b.nome, 'pt-BR')
    )
}

/**
 * Ranking de presença dos insiders nos sommas, a partir da escala.
 *
 * Entram todos os insiders do cadastro — quem não correu nem apoiou no
 * período aparece com zero. O denominador de cada mês (e do consolidado)
 * são os sommas já realizados que tiveram escala montada. Eventos futuros
 * não entram.
 */
export function agregarPresencaInsiders(
  escalas: EscalaPresencaRow[],
  eventosRealizados: EventoRealizado[],
  cadastro: InsiderCadastro[]
): AgregadoPresencaInsiders {
  const dataPorEvento = new Map<string, string>()
  for (const evento of eventosRealizados) {
    if (!evento.id || !evento.data_evento) continue
    dataPorEvento.set(evento.id, evento.data_evento)
  }

  const nomes = new Map<string, string>()
  const ids = new Set<string>()

  for (const insider of cadastro) {
    if (!insider.id) continue
    ids.add(insider.id)
    const nome = (insider.nome ?? '').trim()
    if (nome) nomes.set(insider.id, nome)
  }

  const presentes = new Map<string, Set<string>>()
  const eventosComEscala = new Map<string, string>()

  for (const row of escalas) {
    if (!row.insider_id || !row.evento_id) continue
    const data = dataPorEvento.get(row.evento_id)
    if (!data) continue

    eventosComEscala.set(row.evento_id, data)
    ids.add(row.insider_id)

    const nome = (row.nome ?? '').trim()
    if (nome && !nomes.has(row.insider_id)) nomes.set(row.insider_id, nome)

    if (!estevePresente(row.status)) continue

    const eventos = presentes.get(row.insider_id) ?? new Set<string>()
    eventos.add(row.evento_id)
    presentes.set(row.insider_id, eventos)
  }

  const listaIds = Array.from(ids)
  const todosEventos = new Set(eventosComEscala.keys())
  const porMes = new Map<string, Set<string>>()

  for (const [eventoId, data] of eventosComEscala) {
    const mes = chaveMes(data)
    if (!mes) continue
    const eventos = porMes.get(mes) ?? new Set<string>()
    eventos.add(eventoId)
    porMes.set(mes, eventos)
  }

  const meses = Array.from(porMes.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, eventos]) => ({
      mes,
      totalEventos: eventos.size,
      insiders: montarRanking(listaIds, nomes, presentes, eventos),
    }))

  return {
    meses,
    todos: {
      totalEventos: todosEventos.size,
      insiders: montarRanking(listaIds, nomes, presentes, todosEventos),
    },
  }
}
