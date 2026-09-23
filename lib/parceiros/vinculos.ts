/**
 * Código de parceiro vinculado a evento.
 *
 * O elo entre as duas pontas que já existiam sem se encontrar: o código em
 * `codigo_parceiro` e o `?parceiro=` que a LP do evento lê para gravar
 * `evento_participantes.parceiro_slug`.
 *
 * O vínculo é organizacional, não uma trava: o site aceita qualquer valor no
 * parâmetro, cadastrado ou não. O que ele resolve é o que faltava na prática —
 * montar o link certo e saber quantas inscrições cada parceiro trouxe.
 */

export const TABELA_VINCULOS = 'codigo_parceiro_eventos'

/** De onde saem os links, quando o evento não tem `lp_url` próprio. */
export const SITE_BASE = 'https://sommaclub.com.br'

export interface EventoParaVinculo {
  id: string
  titulo: string
  data_evento: string
  slug: string | null
  lp_url: string | null
}

export interface EventoVinculado extends EventoParaVinculo {
  /** Link de divulgação pronto, ou null quando o evento não tem página. */
  link: string | null
  /** Inscrições já atribuídas a este código neste evento. */
  inscricoes: number
}

export interface CodigoParceiro {
  id: string
  codigo: string
  nome_parceiro: string
  ativo: boolean
  created_at: string
  last_access?: string | null
  eventos: EventoVinculado[]
}

/**
 * Um evento está aberto para divulgação enquanto não terminou. `checkin_status`
 * fica de fora de propósito: ele descreve a portaria no dia, e um check-in
 * fechado não impede ninguém de se inscrever na véspera — foi o caso do SOMMA
 * DAY, com check-in `encerrado` e inscrições correndo.
 */
export function eventoAberto(
  evento: { data_evento: string; evento_encerrado?: boolean | null },
  hoje = new Date()
): boolean {
  if (evento.evento_encerrado) return false
  const dia = hoje.toISOString().slice(0, 10)
  return evento.data_evento >= dia
}

/**
 * O link que o parceiro vai divulgar.
 *
 * Sem página não há link: vincular o código a um evento que não tem LP daria
 * uma URL para lugar nenhum, e é melhor a tela dizer isso do que entregar algo
 * quebrado para o parceiro publicar.
 */
export function montarLink(evento: EventoParaVinculo, codigo: string): string | null {
  const base = evento.lp_url?.trim() || (evento.slug ? `${SITE_BASE}/${evento.slug}` : null)
  if (!base) return null

  const code = codigo.trim().toUpperCase()
  if (!code) return null

  // `lp_url` pode vir com query ou âncora já montadas.
  try {
    const url = new URL(base)
    url.searchParams.set('parceiro', code)
    return url.toString()
  } catch {
    return null
  }
}

/** O evento tem para onde mandar gente? */
export function temPaginaDeInscricao(evento: EventoParaVinculo): boolean {
  return Boolean(evento.lp_url?.trim() || evento.slug?.trim())
}

/**
 * Conta as inscrições de cada código, por evento.
 *
 * A comparação ignora caixa porque o código é gravado em maiúsculas, mas quem
 * clica no link pode ter recebido a URL com qualquer grafia — e o site grava o
 * que veio na query, sem normalizar.
 */
export function contarInscricoes(
  participantes: Array<{ evento_id: string; parceiro_slug: string | null }>
): Map<string, number> {
  const contagem = new Map<string, number>()
  for (const p of participantes) {
    const slug = p.parceiro_slug?.trim().toUpperCase()
    if (!slug) continue
    const chave = `${slug}::${p.evento_id}`
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1)
  }
  return contagem
}

export function chaveContagem(codigo: string, eventoId: string): string {
  return `${codigo.trim().toUpperCase()}::${eventoId}`
}

const CODIGO_VALIDO = /^[A-Z0-9][A-Z0-9_-]{2,29}$/

export function normalizarCodigo(valor: unknown): string {
  return String(valor ?? '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .trim()
}

export function codigoValido(codigo: string): boolean {
  return CODIGO_VALIDO.test(codigo)
}

/** Ids de evento vindos do corpo da requisição, sem repetição e sem lixo. */
export function normalizarEventoIds(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return []
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return [...new Set(bruto.filter((id): id is string => typeof id === 'string' && uuid.test(id)))]
}
