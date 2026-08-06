import { ESCALA_STATUS, META_POR_PELOTAO } from '@/lib/escala-constants'
import type {
  CelulaCalendario,
  EscalaInsiderInput,
  EstadoPreenchimento,
  PelotaoResumo,
} from '@/lib/types/escala'

type InsiderContavel = { status: string; pelotao: string | null }

/** Quantos corredores cada pelotão do evento tem, e como está em relação à meta. */
export function resumirPelotoes(
  pelotoes: string[],
  insiders: InsiderContavel[]
): PelotaoResumo[] {
  return pelotoes.map((pelotao) => {
    const escalados = insiders.filter(
      (i) => i.status === 'corre' && i.pelotao === pelotao
    ).length

    const estado: EstadoPreenchimento =
      escalados >= META_POR_PELOTAO ? 'completo' : escalados > 0 ? 'parcial' : 'vazio'

    return { pelotao, escalados, meta: META_POR_PELOTAO, estado }
  })
}

/** Completo só quando todos os pelotões batem a meta; vazio quando ninguém corre. */
export function estadoDoDia(resumos: PelotaoResumo[]): EstadoPreenchimento {
  if (resumos.length === 0) return 'vazio'
  if (resumos.every((r) => r.estado === 'completo')) return 'completo'
  if (resumos.every((r) => r.escalados === 0)) return 'vazio'
  return 'parcial'
}

/** Retorna a mensagem de erro em pt-BR, ou null quando a escalação é válida. */
export function validarEscalacao(
  input: EscalaInsiderInput,
  pelotoesDoEvento: string[]
): string | null {
  if (!input.insider_id) return 'Selecione o insider'

  if (!ESCALA_STATUS.includes(input.status)) return 'Status inválido'

  if (input.status === 'corre') {
    if (!input.pelotao) return 'Selecione o pelotão de quem vai correr'
    if (!pelotoesDoEvento.includes(input.pelotao)) {
      return `Pelotão "${input.pelotao}" não existe neste evento`
    }
  }

  if (input.status === 'nao_vai') {
    if (!input.motivo || !input.motivo.trim()) return 'Informe o motivo da ausência'
    if (input.atividade_ids && input.atividade_ids.length > 0) {
      return 'Quem não vai não pode ter atividades'
    }
  }

  return null
}

function toISODate(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Grade de 6 semanas (42 células) começando no domingo, para o calendário mensal.
 * `mes` é 1-based: 8 = agosto.
 */
export function buildMonthGrid(ano: number, mes: number): CelulaCalendario[] {
  const primeiro = new Date(ano, mes - 1, 1)
  const inicio = new Date(ano, mes - 1, 1 - primeiro.getDay())

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    return {
      data: toISODate(d),
      dia: d.getDate(),
      no_mes: d.getMonth() === mes - 1 && d.getFullYear() === ano,
    }
  })
}
