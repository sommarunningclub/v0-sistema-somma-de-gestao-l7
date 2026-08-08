/**
 * @jest-environment node
 *
 * jsdom não expõe as globais Fetch/Request/Response que `next/server` precisa
 * para montar `NextRequest`/`NextResponse` — daí o ambiente node.
 *
 * Cobre a correção do achado: `prepareCampaign` devolve `null` tanto quando a
 * audiência é indisponível por erro transiente de leitura quanto — antes da
 * correção — era tratado do mesmo jeito que `{ total: 0 }` (audiência
 * genuinamente vazia). Os dois caiam no mesmo `else` e a campanha virava
 * 'erro' com o diagnóstico falso "Audiência vazia", sem retry (o cron só
 * seleciona campanhas 'agendada'/'enviando').
 *
 * O Supabase é substituído por um banco em memória mínimo — só os filtros
 * (eq/lte) que esta rota usa sobre `email_campaigns` — no mesmo espírito do
 * fake em `lib/email/__tests__/dispatch-slice.test.ts`.
 */

type FilterOp = 'eq' | 'lte'

interface Filter {
  op: FilterOp
  column: string
  value: unknown
}

interface QueryCall {
  action: 'select' | 'update'
  payload: Record<string, unknown> | null
  filters: Filter[]
}

type Row = Record<string, unknown>

function matchesFilter(row: Row, f: Filter): boolean {
  const actual = row[f.column]
  switch (f.op) {
    case 'eq':
      return actual === f.value
    case 'lte':
      // Timestamps ISO comparam lexicograficamente na mesma ordem que
      // cronologicamente.
      if (actual === null || actual === undefined) return false
      return String(actual) <= String(f.value)
    default:
      return false
  }
}

function matchesAll(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => matchesFilter(row, f))
}

/** Query builder encadeável e "thenable", como o do supabase-js. */
class FakeQuery implements PromiseLike<{ data: unknown; error: null }> {
  private call: QueryCall = { action: 'select', payload: null, filters: [] }

  constructor(private readonly respond: (call: QueryCall) => { data: unknown; error: null }) {}

  select(_columns?: string): this {
    return this
  }

  update(payload: Record<string, unknown>): this {
    this.call.action = 'update'
    this.call.payload = payload
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ op: 'eq', column, value })
    return this
  }

  lte(column: string, value: unknown): this {
    this.call.filters.push({ op: 'lte', column, value })
    return this
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.respond(this.call))
      .then(onfulfilled, onrejected)
  }
}

interface CampaignRow extends Row {
  id: string
  status: string
  scheduled_at: string
  error: string | null
  started_at: string | null
  finished_at: string | null
}

function createWorld(campaigns: CampaignRow[]) {
  const calls: QueryCall[] = []

  const respond = (call: QueryCall): { data: unknown; error: null } => {
    calls.push(call)

    if (call.action === 'select') {
      const rows = campaigns.filter((r) => matchesAll(r, call.filters))
      return { data: rows.map((r) => ({ id: r.id })), error: null }
    }

    // update — replica o guard `.eq('status', 'agendada')`: só as linhas que
    // ainda casam com os filtros no estado atual são alteradas.
    const matched = campaigns.filter((r) => matchesAll(r, call.filters))
    for (const row of matched) Object.assign(row, call.payload)
    return { data: matched, error: null }
  }

  const client = { from: (_table: string) => new FakeQuery(respond) }
  return { campaigns, calls, client }
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockClient: { from: (table: string) => FakeQuery }

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}))

const mockPrepareCampaign = jest.fn()
const mockDispatchSlice = jest.fn()
const mockFinalizeSlice = jest.fn()

jest.mock('@/lib/email/dispatch', () => ({
  prepareCampaign: (...args: unknown[]) => mockPrepareCampaign(...args),
  dispatchSlice: (...args: unknown[]) => mockDispatchSlice(...args),
  finalizeSlice: (...args: unknown[]) => mockFinalizeSlice(...args),
}))

import { NextRequest } from 'next/server'
import { GET } from '../route'

const CRON_SECRET = 'segredo-de-teste'

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/cron/email-campaigns', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function dueCampaign(overrides: Partial<CampaignRow> = {}): CampaignRow {
  return {
    id: 'campanha-1',
    status: 'agendada',
    scheduled_at: '2026-08-08T08:00:00.000Z',
    error: null,
    started_at: null,
    finished_at: null,
    ...overrides,
  }
}

let consoleError: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  // Usado só quando uma campanha promovida a 'enviando' também é varrida
  // pela segunda etapa (campanhas em andamento) na mesma execução.
  mockDispatchSlice.mockResolvedValue({
    ok: true,
    sent: 0,
    failed: 0,
    remaining: 0,
    fatal: false,
    canceled: false,
    error: null,
  })
  mockFinalizeSlice.mockResolvedValue(undefined)
  // O módulo loga alto em cada aborto — é intencional em produção e só ruído aqui.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('GET /api/cron/email-campaigns — promoção de agendadas', () => {
  it('mantém a campanha "agendada" quando prepareCampaign não consegue ler a audiência', async () => {
    const world = createWorld([dueCampaign()])
    mockClient = world.client
    mockPrepareCampaign.mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    // Não vira 'erro' com o diagnóstico falso "Audiência vazia" — fica como
    // estava, para o próximo tick do cron (5 min depois) tentar de novo.
    expect(world.campaigns[0].status).toBe('agendada')
    expect(world.campaigns[0].error).toBeNull()
    expect(world.campaigns[0].finished_at).toBeNull()
    expect(world.campaigns[0].started_at).toBeNull()

    // Nenhum UPDATE foi emitido para essa campanha: a linha nunca foi tocada.
    expect(world.calls.filter((c) => c.action === 'update')).toHaveLength(0)

    // A resposta do cron distingue o adiamento de um processamento normal.
    expect(body.postponed).toEqual(['campanha-1'])
    expect(body.processed).toEqual([])
  })

  it('marca "erro" / "Audiência vazia" quando a audiência é genuinamente vazia', async () => {
    const world = createWorld([dueCampaign()])
    mockClient = world.client
    mockPrepareCampaign.mockResolvedValue({ total: 0 })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(world.campaigns[0].status).toBe('erro')
    expect(world.campaigns[0].error).toBe('Audiência vazia')
    expect(world.campaigns[0].finished_at).not.toBeNull()
    expect(body.postponed).toEqual([])
  })

  it('promove para "enviando" quando a audiência tem gente', async () => {
    const world = createWorld([dueCampaign()])
    mockClient = world.client
    mockPrepareCampaign.mockResolvedValue({ total: 6873 })

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(world.campaigns[0].status).toBe('enviando')
    expect(world.campaigns[0].started_at).not.toBeNull()
    expect(body.postponed).toEqual([])
  })
})
