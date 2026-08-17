import { onlyDigits } from '@/lib/insider/validation'

export const LIMITE_RANKING_INSIDERS = 10

export interface InsiderCadastro {
  id: string
  nome: string | null
  cpf: string | null
}

export interface CheckinPresenca {
  cpf: string | null
  evento_id: string | null
}

export interface InsiderPresencaRank {
  id: string
  nome: string
  eventos: number
}

interface AgregadoInsider {
  id: string
  nome: string
  eventos: Set<string>
}

/**
 * Ranking de presença dos insiders nos sommas.
 *
 * Mesmo critério do Top 10 de membros: eventos distintos com check-in
 * registrado. A diferença é o universo — só entra quem está em
 * `dados_insiders`, identificado pelo CPF (com ou sem máscara). O nome
 * exibido é o do cadastro de insider, não a grafia do check-in.
 */
export function agregarPresencaInsiders(
  checkins: CheckinPresenca[],
  insiders: InsiderCadastro[]
): InsiderPresencaRank[] {
  const porCpf = new Map<string, AgregadoInsider>()

  for (const insider of insiders) {
    const cpf = onlyDigits(insider.cpf ?? '')
    if (!cpf || porCpf.has(cpf)) continue
    porCpf.set(cpf, {
      id: insider.id,
      nome: (insider.nome ?? '').trim() || 'Insider sem nome',
      eventos: new Set(),
    })
  }

  for (const row of checkins) {
    if (!row.evento_id) continue
    const cpf = onlyDigits(row.cpf ?? '')
    if (!cpf) continue
    const insider = porCpf.get(cpf)
    if (insider) insider.eventos.add(row.evento_id)
  }

  return Array.from(porCpf.values())
    .filter((insider) => insider.eventos.size > 0)
    .sort(
      (a, b) =>
        b.eventos.size - a.eventos.size || a.nome.localeCompare(b.nome, 'pt-BR')
    )
    .slice(0, LIMITE_RANKING_INSIDERS)
    .map((insider) => ({
      id: insider.id,
      nome: insider.nome,
      eventos: insider.eventos.size,
    }))
}
