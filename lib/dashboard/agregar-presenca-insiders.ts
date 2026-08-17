import type { EscalaStatus } from '@/lib/escala-constants'

export const LIMITE_RANKING_INSIDERS = 10

/** Na escala, presença é quem correu ou apoiou — "não vai" é ausência. */
export const STATUS_PRESENCA_ESCALA = ['corre', 'apoio'] as const

export interface EscalaPresencaRow {
  insider_id: string
  evento_id: string
  status: EscalaStatus
  nome: string | null
}

export interface InsiderPresencaRank {
  id: string
  nome: string
  eventos: number
}

export interface AgregadoPresencaInsiders {
  totalEventos: number
  insiders: InsiderPresencaRank[]
}

interface AgregadoInsider {
  id: string
  nome: string
  eventos: Set<string>
}

function estevePresente(status: EscalaStatus): boolean {
  return (STATUS_PRESENCA_ESCALA as readonly string[]).includes(status)
}

/**
 * Ranking de presença dos insiders nos sommas, a partir da escala.
 *
 * O denominador é o número de sommas já realizados que tiveram escala
 * montada. O numerador, por insider, são os eventos distintos em que o
 * status foi `corre` ou `apoio`. Eventos futuros não entram — escala
 * futura é convocação, não presença.
 */
export function agregarPresencaInsiders(
  escalas: EscalaPresencaRow[],
  eventosRealizados: ReadonlySet<string>
): AgregadoPresencaInsiders {
  const eventosComEscala = new Set<string>()
  const porInsider = new Map<string, AgregadoInsider>()

  for (const row of escalas) {
    if (!row.insider_id || !row.evento_id) continue
    if (!eventosRealizados.has(row.evento_id)) continue

    eventosComEscala.add(row.evento_id)

    if (!estevePresente(row.status)) continue

    const insider =
      porInsider.get(row.insider_id) ??
      {
        id: row.insider_id,
        nome: '',
        eventos: new Set<string>(),
      }

    const nome = (row.nome ?? '').trim()
    if (nome) insider.nome = nome
    insider.eventos.add(row.evento_id)
    porInsider.set(row.insider_id, insider)
  }

  const insiders = Array.from(porInsider.values())
    .filter((insider) => insider.eventos.size > 0)
    .sort(
      (a, b) =>
        b.eventos.size - a.eventos.size || a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .slice(0, LIMITE_RANKING_INSIDERS)
    .map((insider) => ({
      id: insider.id,
      nome: insider.nome || 'Insider sem nome',
      eventos: insider.eventos.size,
    }))

  return { totalEventos: eventosComEscala.size, insiders }
}
