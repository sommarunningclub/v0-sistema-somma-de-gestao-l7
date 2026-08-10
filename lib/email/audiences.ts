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
 * Resolve a seleção em destinatários finais: filtra cada base, junta os
 * individuais, deduplica por e-mail entre todos e remove os suprimidos.
 *
 * `null` quando alguma base ou a lista de supressão não pôde ser lida — o
 * chamador não deve tratar um resultado incompleto como a audiência real.
 */
export async function resolveAudience(selection: AudienceSelection): Promise<Recipient[] | null> {
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

  return filterSuppressed(dedupeRecipients(lists))
}
