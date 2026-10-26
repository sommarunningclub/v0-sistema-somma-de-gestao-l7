/**
 * Nova Assessoria: contatos da BORA vindos do site.
 *
 * O site (sommaclub.com.br/assessoria e os links de professor) grava cada
 * visita e cada contato em `nova_assessoria_eventos`, e distribui os contatos
 * de /assessoria pelo rodízio de `nova_assessoria_rodizio`. Este arquivo tem
 * os tipos e as contas do painel, sem banco: é o que dá para testar.
 *
 * Fuso: tudo que vira "dia" ou "hora" é contado no horário de Brasília.
 */

export type TipoEvento = 'visita' | 'contato'

export interface EventoBora {
  id: number
  criado_em: string
  tipo: TipoEvento
  pagina: string
  professor: string | null
  professor_nome: string | null
  professor_whatsapp: string | null
  rodizio_posicao: number | null
  repetido: boolean
  nome: string | null
  whatsapp: string | null
  visitante_id: string | null
  sessao_id: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  click_ids: Record<string, string> | null
  referrer: string | null
  url: string | null
  primeiro_toque: Record<string, unknown> | null
  dispositivo: string | null
  navegador: string | null
  sistema: string | null
  user_agent: string | null
  tela: string | null
  idioma: string | null
  fuso: string | null
  ip: string | null
  cidade: string | null
  regiao: string | null
  pais: string | null
}

export interface Rodizio {
  ordem: string[]
  /** Quantas pessoas já foram distribuídas. */
  posicao: number
  /** Slug de quem recebe a próxima pessoa. */
  proximo: string | null
}

export type Periodo = 'hoje' | '7d' | '30d' | 'tudo'

export const PERIODOS: Periodo[] = ['hoje', '7d', '30d', 'tudo']

/** Nome de exibição por slug. Professor novo no site aparece pelo slug até entrar aqui. */
export const PROFESSORES: Record<string, string> = {
  joseph: 'Joseph Pereira (JôJô)',
  alexandre: 'Alexandre Alves',
  mateus: 'Mateus Fonseca',
  'gabriel-brito': 'Gabriel Brito',
}

export function nomeDoProfessor(slug: string | null | undefined): string {
  if (!slug) return '-'
  return PROFESSORES[slug] ?? slug
}

export function nomeDaPagina(pagina: string): string {
  if (pagina === 'assessoria') return '/assessoria (rodízio)'
  if (pagina.startsWith('bio-')) return `Link de ${nomeDoProfessor(pagina.slice(4))}`
  return pagina
}

const FUSO = 'America/Sao_Paulo'
// Brasília está em UTC-3 o ano todo desde 2019 (sem horário de verão).
const OFFSET_BRASILIA_MS = 3 * 60 * 60 * 1000

/** Início do período em ISO, contado no horário de Brasília. Nulo para "tudo". */
export function inicioDoPeriodo(periodo: Periodo, agora = new Date()): string | null {
  if (periodo === 'tudo') return null
  const emBrasilia = new Date(agora.getTime() - OFFSET_BRASILIA_MS)
  emBrasilia.setUTCHours(0, 0, 0, 0)
  const dias = periodo === 'hoje' ? 0 : periodo === '7d' ? 6 : 29
  emBrasilia.setUTCDate(emBrasilia.getUTCDate() - dias)
  return new Date(emBrasilia.getTime() + OFFSET_BRASILIA_MS).toISOString()
}

export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function diaEmBrasilia(iso: string): string {
  // en-CA formata como AAAA-MM-DD, que ordena como texto.
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO })
}

function horaEmBrasilia(iso: string): number {
  return Number(new Date(iso).toLocaleString('en-US', { timeZone: FUSO, hour: '2-digit', hour12: false })) % 24
}

function dominio(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * De onde a pessoa veio, numa etiqueta só. UTM manda; sem UTM, o click id do
 * anúncio; sem nada disso, o site de onde ela chegou; sem referrer, "direto".
 */
export function origemDe(e: Pick<EventoBora, 'utm_source' | 'utm_medium' | 'click_ids' | 'referrer'>): string {
  if (e.utm_source) return e.utm_medium ? `${e.utm_source} / ${e.utm_medium}` : e.utm_source
  const ids = e.click_ids ?? {}
  if (ids.fbclid) return 'Meta (fbclid)'
  if (ids.gclid || ids.gbraid || ids.wbraid) return 'Google Ads (gclid)'
  if (ids.ttclid) return 'TikTok (ttclid)'
  if (ids.msclkid) return 'Bing (msclkid)'
  if (ids.ref) return `ref: ${ids.ref}`
  if (e.referrer) return dominio(e.referrer) ?? e.referrer
  return 'direto'
}

export interface Linha {
  chave: string
  rotulo: string
  visitas: number
  contatos: number
}

function agrupar(eventos: EventoBora[], chaveDe: (e: EventoBora) => string, rotuloDe: (chave: string) => string = (c) => c): Linha[] {
  const mapa = new Map<string, Linha>()
  for (const e of eventos) {
    const chave = chaveDe(e)
    const linha = mapa.get(chave) ?? { chave, rotulo: rotuloDe(chave), visitas: 0, contatos: 0 }
    if (e.tipo === 'visita') linha.visitas++
    else linha.contatos++
    mapa.set(chave, linha)
  }
  return Array.from(mapa.values()).sort((a, b) => b.contatos - a.contatos || b.visitas - a.visitas)
}

export interface LinhaProfessor {
  slug: string
  nome: string
  total: number
  rodizio: number
  link: number
  repetidos: number
}

export interface Resumo {
  visitas: number
  visitantes: number
  contatos: number
  /** Pessoas diferentes que pediram contato (pelo WhatsApp). */
  pessoas: number
  /** pessoas / visitantes, de 0 a 1. Nulo sem visitante. */
  conversao: number | null
  porProfessor: LinhaProfessor[]
  porOrigem: Linha[]
  porCampanha: Linha[]
  porPagina: Linha[]
  porAparelho: Linha[]
  porDia: Linha[]
  /** Contatos por hora do dia (0 a 23). */
  porHora: number[]
}

export function resumir(eventos: EventoBora[]): Resumo {
  const visitas = eventos.filter((e) => e.tipo === 'visita')
  const contatos = eventos.filter((e) => e.tipo === 'contato')
  const visitantes = new Set(visitas.map((e) => e.visitante_id ?? `ip:${e.ip}`)).size
  const pessoas = new Set(contatos.map((e) => e.whatsapp ?? `id:${e.id}`)).size

  const professores = new Map<string, LinhaProfessor>()
  for (const slug of Object.keys(PROFESSORES)) {
    professores.set(slug, { slug, nome: nomeDoProfessor(slug), total: 0, rodizio: 0, link: 0, repetidos: 0 })
  }
  for (const e of contatos) {
    const slug = e.professor ?? '-'
    const linha = professores.get(slug) ?? { slug, nome: e.professor_nome ?? slug, total: 0, rodizio: 0, link: 0, repetidos: 0 }
    linha.total++
    if (e.repetido) linha.repetidos++
    else if (e.pagina === 'assessoria') linha.rodizio++
    else linha.link++
    professores.set(slug, linha)
  }

  const porHora = Array.from({ length: 24 }, () => 0)
  for (const e of contatos) porHora[horaEmBrasilia(e.criado_em)]++

  return {
    visitas: visitas.length,
    visitantes,
    contatos: contatos.length,
    pessoas,
    conversao: visitantes ? pessoas / visitantes : null,
    porProfessor: Array.from(professores.values()),
    porOrigem: agrupar(eventos, origemDe),
    porCampanha: agrupar(eventos, (e) => e.utm_campaign ?? '(sem campanha)'),
    porPagina: agrupar(eventos, (e) => e.pagina, nomeDaPagina),
    porAparelho: agrupar(eventos, (e) => [e.dispositivo, e.navegador].filter(Boolean).join(' · ') || '(desconhecido)'),
    porDia: agrupar(eventos, (e) => diaEmBrasilia(e.criado_em)).sort((a, b) => a.chave.localeCompare(b.chave)),
    porHora,
  }
}

const COLUNAS_CSV: Array<[string, (e: EventoBora) => unknown]> = [
  ['data_hora', (e) => formatarDataHora(e.criado_em)],
  ['nome', (e) => e.nome],
  ['whatsapp', (e) => e.whatsapp],
  ['professor', (e) => nomeDoProfessor(e.professor)],
  ['pagina', (e) => nomeDaPagina(e.pagina)],
  ['rodizio_posicao', (e) => e.rodizio_posicao],
  ['repetido', (e) => (e.repetido ? 'sim' : 'não')],
  ['origem', (e) => origemDe(e)],
  ['utm_source', (e) => e.utm_source],
  ['utm_medium', (e) => e.utm_medium],
  ['utm_campaign', (e) => e.utm_campaign],
  ['utm_term', (e) => e.utm_term],
  ['utm_content', (e) => e.utm_content],
  ['click_ids', (e) => (e.click_ids ? JSON.stringify(e.click_ids) : '')],
  ['referrer', (e) => e.referrer],
  ['url', (e) => e.url],
  ['primeiro_toque', (e) => (e.primeiro_toque ? JSON.stringify(e.primeiro_toque) : '')],
  ['dispositivo', (e) => e.dispositivo],
  ['navegador', (e) => e.navegador],
  ['sistema', (e) => e.sistema],
  ['cidade', (e) => e.cidade],
  ['regiao', (e) => e.regiao],
  ['pais', (e) => e.pais],
  ['ip', (e) => e.ip],
  ['visitante_id', (e) => e.visitante_id],
  ['sessao_id', (e) => e.sessao_id],
  ['user_agent', (e) => e.user_agent],
]

/** CSV dos contatos, com separador ";" para abrir direto no Excel em português. */
export function contatosEmCsv(eventos: EventoBora[]): string {
  const celula = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v)
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  const linhas = eventos
    .filter((e) => e.tipo === 'contato')
    .map((e) => COLUNAS_CSV.map(([, f]) => celula(f(e))).join(';'))
  return [COLUNAS_CSV.map(([n]) => n).join(';'), ...linhas].join('\r\n')
}
