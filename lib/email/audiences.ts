import { createClient } from '@supabase/supabase-js'
import { dedupeRecipients, normalizeEmail, type Recipient } from './normalize'
import { filterSuppressed } from './suppression'
import type { AudienceIndividual, AudienceKey, AudienceSelection } from './types'

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export interface FilterDef {
  key: string
  label: string
  /** 'text' abre campo livre; 'select' usa as opções; 'evento' é populado da tabela eventos. */
  kind: 'text' | 'select' | 'evento'
  options?: Array<{ value: string; label: string }>
}

export interface AudienceSource {
  key: AudienceKey
  label: string
  table: string
  emailCol: string
  nameCol: string
  filters: FilterDef[]
}

export const AUDIENCE_SOURCES: Record<AudienceKey, AudienceSource> = {
  membros: {
    key: 'membros',
    label: 'Membros do clube',
    table: 'cadastro_site',
    emailCol: 'email',
    nameCol: 'nome_completo',
    filters: [],
  },
  checkins: {
    key: 'checkins',
    label: 'Check-ins de eventos',
    table: 'checkins',
    emailCol: 'email',
    nameCol: 'nome_completo',
    filters: [
      { key: 'evento_id', label: 'Evento', kind: 'evento' },
      { key: 'pelotao', label: 'Pelotão', kind: 'text' },
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ],
      },
    ],
  },
  lista_vip: {
    key: 'lista_vip',
    label: 'Lista VIP SommaDay',
    table: 'lista_vip',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      {
        key: 'status_cupom',
        label: 'Status do cupom',
        kind: 'select',
        options: [
          { value: 'ativo', label: 'Ativo' },
          { value: 'usado', label: 'Usado' },
          { value: 'expirado', label: 'Expirado' },
          { value: 'cancelado', label: 'Cancelado' },
        ],
      },
    ],
  },
  /**
   * Base de uma campanha do SITE (novo-site-somma-v3), não deste sistema.
   *
   * Os dois projetos dividem o banco, mas as campanhas do site vivem em
   * `campanha_contatos`, uma tabela que guarda a base de TODAS elas de uma vez
   * e que este módulo não conhece. A fonte aqui é a view `campanha_swr_base`
   * (migration 20260827103000 do projeto do site), e a view é que faz duas
   * coisas que um filtro desta tela não faria com segurança:
   *
   *   - fixa a campanha, para que esquecer de marcar um filtro não mande o
   *     e-mail do Sunset Wine Run para a base do Desafio das Esteiras;
   *   - remove quem está em `descadastros_globais`, o descadastro DO SITE. Ele
   *     é uma lista separada de `email_suppressions` e nenhuma das duas conhece
   *     a outra; sem isso, quem pediu para sair pelo rodapé de um e-mail do
   *     site voltaria a receber por aqui. A supressão deste módulo continua
   *     sendo aplicada por cima, no disparo — as duas se somam.
   *
   * Para publicar outra campanha do site aqui, crie a view equivalente e
   * registre mais uma entrada; não troque isto por um filtro de campanha.
   */
  sunset_wine_run: {
    key: 'sunset_wine_run',
    label: 'Base da campanha Sunset Wine Run (site)',
    table: 'campanha_swr_base',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      {
        key: 'segmento',
        label: 'Segmento',
        kind: 'select',
        options: [
          { value: 'cadastro-site', label: 'Cadastro do site' },
          { value: 'checkins', label: 'Check-ins' },
          { value: 'manual', label: 'Avulsos (manual)' },
        ],
      },
    ],
  },
  /**
   * `cadastro_site` + `checkins` numa base só, sem quem descadastrou pelo SITE.
   *
   * As bases `membros` e `checkins` acima leem as tabelas cruas, e a supressão
   * deste módulo (`email_suppressions`) não conhece `descadastros_globais`, o
   * descadastro dos e-mails do site. Mandar para as duas bases por aqui
   * reenviaria para quem pediu para sair pelo rodapé de um e-mail do site. A
   * view `campanha_base_geral` (sql/022) tira essas pessoas por construção; a
   * supressão daqui continua valendo por cima, no disparo.
   *
   * O dedupe por e-mail entre as duas tabelas é o de sempre (`dedupeRecipients`):
   * quem está no cadastro e fez check-in em oito eventos recebe um e-mail só.
   */
  base_geral: {
    key: 'base_geral',
    label: 'Base geral: cadastro do site + check-ins (sem descadastrados do site)',
    table: 'campanha_base_geral',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      {
        key: 'segmento',
        label: 'Origem',
        kind: 'select',
        options: [
          { value: 'cadastro-site', label: 'Cadastro do site' },
          { value: 'checkins', label: 'Check-ins' },
        ],
      },
    ],
  },
  lista_espera: {
    key: 'lista_espera',
    label: 'Lista de espera assessoria',
    table: 'lista_vip_assessoria',
    emailCol: 'email',
    nameCol: 'nome',
    filters: [
      { key: 'cidade', label: 'Cidade', kind: 'text' },
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'masculino', label: 'Masculino' },
          { value: 'feminino', label: 'Feminino' },
        ],
      },
      { key: 'status', label: 'Status', kind: 'text' },
    ],
  },
}

export function isAudienceKey(value: string): value is AudienceKey {
  return Object.prototype.hasOwnProperty.call(AUDIENCE_SOURCES, value)
}

export function buildAudienceQuery(
  source: AudienceSource,
  filtros: Record<string, string>,
): { table: string; select: string; eq: Array<[string, string]> } {
  const declared = new Set(source.filters.map((f) => f.key))
  const eq: Array<[string, string]> = []

  for (const [key, raw] of Object.entries(filtros ?? {})) {
    if (!declared.has(key)) continue
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) continue
    eq.push([key, value])
  }

  return { table: source.table, select: `${source.emailCol},${source.nameCol}`, eq }
}

const PAGE_SIZE = 1000

/** `null` quando alguma página falhou — uma base parcial é pior que nenhuma. */
async function fetchBase(
  source: AudienceSource,
  filtros: Record<string, string>,
): Promise<Recipient[] | null> {
  const supabase = getSupabase()
  const { table, select, eq } = buildAudienceQuery(source, filtros)
  const out: Recipient[] = []

  // Paginado — o PostgREST corta em 1000 por requisição.
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from(table)
      .select(select)
      // Sem ORDER BY o Postgres não garante a mesma ordem entre duas
      // consultas paginadas, e uma escrita concorrente pode deslocar uma linha
      // através da fronteira de página — a base sairia com menos endereços do
      // que tem, de forma não determinística, contrariando a promessa de que o
      // número da revisão é o número que vai receber. A coluna de e-mail pode
      // repetir dentro da base, mas linhas empatadas têm o mesmo endereço e o
      // dedupe as colapsaria de qualquer forma: nenhum destinatário distinto
      // se perde.
      .order(source.emailCol)
      .range(from, from + PAGE_SIZE - 1)
    for (const [col, value] of eq) query = query.eq(col, value)

    const { data, error } = await query
    if (error) {
      console.error(`[email] fetchBase ${source.key} error:`, error)
      return null
    }
    if (!data || data.length === 0) break

    // `select` é montado em runtime, então o supabase-js não consegue tipar a
    // consulta estaticamente — o cast via `unknown` é necessário aqui.
    for (const row of data as unknown as Array<Record<string, unknown>>) {
      out.push({
        email: String(row[source.emailCol] ?? ''),
        nome: (row[source.nameCol] as string | null) ?? null,
        sourceBase: source.key,
      })
    }

    if (data.length < PAGE_SIZE) break
  }

  return out
}

/** Converte destinatários avulsos em `Recipient`, descartando e-mail inválido. */
export function individuaisToRecipients(
  individuais: AudienceIndividual[] | undefined,
): Recipient[] {
  if (!individuais?.length) return []
  const out: Recipient[] = []
  for (const item of individuais) {
    const email = normalizeEmail(item.email)
    if (!email) continue
    out.push({ email, nome: item.nome ?? null, sourceBase: 'individual' })
  }
  return out
}

/**
 * Duas leituras da mesma verdade, propositalmente.
 *
 * `email_campaign_recipients.status` é um snapshot: um evento terminal
 * (bounce/spam/falha) sobrescreve um 'aberto' anterior — ver TERMINAL_STATUSES
 * no webhook — e a abertura sumiria daqui. `email_campaign_events` é um log
 * append-only, então guarda a abertura mesmo depois disso. A união das duas
 * evita reenviar para quem já abriu por causa de um efeito colateral de status.
 */
const OPENED_SOURCES = [
  { table: 'email_campaign_recipients', column: 'status', values: ['aberto', 'clicado'] },
  { table: 'email_campaign_events', column: 'type', values: ['opened', 'clicked'] },
] as const

/**
 * E-mails que abriram (ou clicaram em) qualquer uma das campanhas informadas.
 *
 * `null` quando alguma página falhou. É o ponto mais delicado da régua: uma
 * lista parcial de abridores não parece um erro, parece uma etapa com mais
 * gente para reenviar — e o e-mail sairia de novo para quem já tinha aberto,
 * sem nenhum sinal. Fail-closed, igual à lista de supressão.
 */
async function fetchOpenedEmails(campaignIds: string[]): Promise<Set<string> | null> {
  if (campaignIds.length === 0) return new Set()

  const supabase = getSupabase()
  const set = new Set<string>()

  for (const source of OPENED_SOURCES) {
    // Paginado e ordenado pela PK: sem ORDER BY o Postgres não garante a mesma
    // ordem entre duas páginas, e estas tabelas são escritas pelo webhook
    // enquanto a consulta roda (aberturas continuam chegando durante o preparo
    // da etapa seguinte).
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(source.table)
        .select('email')
        .in('campaign_id', campaignIds)
        .in(source.column, source.values as unknown as string[])
        .order('id')
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        console.error(`[email] fetchOpenedEmails ${source.table} error:`, error)
        return null
      }
      if (!data || data.length === 0) break

      for (const row of data as unknown as Array<{ email: string | null }>) {
        const email = normalizeEmail(row.email)
        if (email) set.add(email)
      }

      if (data.length < PAGE_SIZE) break
    }
  }

  return set
}

export interface ResolvedAudience {
  recipients: Recipient[]
  /** Quantos saíram por já terem aberto uma das campanhas de `excluir_abertos_de`. */
  excluidosPorAbertura: number
  /** Quantos saíram por NÃO terem aberto nenhuma das campanhas de `somente_abertos_de`. */
  excluidosPorNaoAbertura: number
}

/**
 * Resolve a seleção em destinatários finais: filtra cada base, junta os
 * individuais, deduplica por e-mail entre todos, tira quem já abriu as
 * campanhas marcadas em `excluir_abertos_de` e remove os suprimidos.
 *
 * `null` quando alguma base, a lista de abridores ou a lista de supressão não
 * pôde ser lida — o chamador não deve tratar um resultado incompleto como a
 * audiência real.
 */
export async function resolveAudienceDetailed(
  selection: AudienceSelection,
): Promise<ResolvedAudience | null> {
  const bases = selection?.bases ?? []
  const lists: Recipient[][] = []

  for (const base of bases) {
    if (!isAudienceKey(base.key)) continue
    const rows = await fetchBase(AUDIENCE_SOURCES[base.key], base.filtros ?? {})
    if (rows === null) return null
    lists.push(rows)
  }

  // Bases entram primeiro: se uma pessoa também estiver na lista de
  // individuais, o dedupe preserva a `sourceBase` da base, não 'individual'.
  lists.push(individuaisToRecipients(selection.individuais))

  const deduped = dedupeRecipients(lists)

  // A exclusão vale para a seleção inteira, individuais incluídos: a regra é
  // "não mandar de novo para quem já abriu", e não "não mandar de novo, exceto
  // para quem eu digitei à mão".
  const abertos = await fetchOpenedEmails(selection?.excluir_abertos_de ?? [])
  if (abertos === null) return null

  const naoAbriram =
    abertos.size === 0 ? deduped : deduped.filter((r) => !abertos.has(r.email))

  // Só os engajados, quando pedido. Lista vazia em `somente_abertos_de` não
  // filtra nada; lista preenchida sem nenhuma abertura esvazia a audiência de
  // propósito: "só quem abriu" nunca pode virar "todo mundo".
  const somente = selection?.somente_abertos_de ?? []
  let engajados = naoAbriram
  if (somente.length > 0) {
    const abriram = await fetchOpenedEmails(somente)
    if (abriram === null) return null
    engajados = naoAbriram.filter((r) => abriram.has(r.email))
  }

  const recipients = await filterSuppressed(engajados)
  if (recipients === null) return null

  return {
    recipients,
    excluidosPorAbertura: deduped.length - naoAbriram.length,
    excluidosPorNaoAbertura: naoAbriram.length - engajados.length,
  }
}

/** Só os destinatários. Mantida porque é o que o disparo consome. */
export async function resolveAudience(selection: AudienceSelection): Promise<Recipient[] | null> {
  const resolved = await resolveAudienceDetailed(selection)
  return resolved === null ? null : resolved.recipients
}
