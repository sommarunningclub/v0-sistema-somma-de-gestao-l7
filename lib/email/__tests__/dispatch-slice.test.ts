/**
 * @jest-environment node
 *
 * jsdom não expõe `TextEncoder` globalmente e o SDK da Resend (via postal-mime)
 * o usa no carregamento do módulo — daí o ambiente node, como em
 * `dispatch.test.ts`.
 *
 * Cobre as quatro garantias que o disparo precisa dar e que nenhum teste
 * alcançava antes:
 *
 *  - C1 reserva atômica: duas execuções concorrentes não enviam para a mesma
 *    pessoa;
 *  - C2 supressão indisponível: erro de infraestrutura não queima destinatário;
 *  - C3 falha precoce: `remaining === 0` sem sucesso não encerra a campanha;
 *  - C4 cancelamento: para o envio no meio e não é sobrescrito depois.
 *
 * O Supabase é substituído por um banco em memória que respeita os filtros do
 * PostgREST usados aqui (eq/is/in/lt, order, limit, range, count head) — sem
 * isso os testes provariam apenas que as funções foram chamadas, não que a
 * regra vale.
 */

// ---------------------------------------------------------------------------
// Banco em memória
// ---------------------------------------------------------------------------

type FilterOp = 'eq' | 'is' | 'in' | 'lt'

interface Filter {
  op: FilterOp
  column: string
  value: unknown
}

interface QueryCall {
  table: string
  action: 'select' | 'update' | 'upsert'
  payload: Record<string, unknown> | null
  columns: string | null
  head: boolean
  filters: Filter[]
  orders: string[]
  limit: number | null
  range: [number, number] | null
}

interface QueryResult {
  data: unknown
  error: { message: string } | null
  count?: number | null
}

type Row = Record<string, unknown>

interface RecipientRow extends Row {
  id: string
  campaign_id: string
  email: string
  nome: string | null
  status: string
  sent_at: string | null
  error: string | null
  resend_email_id: string | null
}

function matchesFilter(row: Row, f: Filter): boolean {
  const actual = row[f.column]
  switch (f.op) {
    case 'eq':
      return actual === f.value
    case 'is':
      // `.is(col, null)` no PostgREST é IS NULL.
      return f.value === null ? actual === null || actual === undefined : actual === f.value
    case 'in':
      return Array.isArray(f.value) && (f.value as unknown[]).includes(actual)
    case 'lt':
      // NULL < x é NULL no SQL: a linha não entra. Timestamps ISO comparam
      // lexicograficamente na mesma ordem que cronologicamente.
      if (actual === null || actual === undefined) return false
      return String(actual) < String(f.value)
    default:
      return false
  }
}

function matchesAll(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => matchesFilter(row, f))
}

/** Query builder encadeável e "thenable", como o do supabase-js. */
class FakeQuery implements PromiseLike<QueryResult> {
  private call: QueryCall

  constructor(
    table: string,
    private readonly respond: (call: QueryCall) => QueryResult,
  ) {
    this.call = {
      table,
      action: 'select',
      payload: null,
      columns: null,
      head: false,
      filters: [],
      orders: [],
      limit: null,
      range: null,
    }
  }

  select(columns?: string, opts?: { count?: string; head?: boolean }): this {
    // `.select()` depois de `.update()` é o RETURNING — não vira outra consulta.
    if (this.call.action === 'select') {
      this.call.columns = columns ?? null
      this.call.head = opts?.head === true
    }
    return this
  }

  update(payload: Record<string, unknown>): this {
    this.call.action = 'update'
    this.call.payload = payload
    return this
  }

  upsert(payload: unknown, _opts?: unknown): this {
    this.call.action = 'upsert'
    this.call.payload = { rows: payload }
    return this
  }

  eq(column: string, value: unknown): this {
    this.call.filters.push({ op: 'eq', column, value })
    return this
  }

  is(column: string, value: unknown): this {
    this.call.filters.push({ op: 'is', column, value })
    return this
  }

  in(column: string, value: unknown[]): this {
    this.call.filters.push({ op: 'in', column, value })
    return this
  }

  lt(column: string, value: unknown): this {
    this.call.filters.push({ op: 'lt', column, value })
    return this
  }

  order(column: string, _opts?: unknown): this {
    this.call.orders.push(column)
    return this
  }

  limit(n: number): this {
    this.call.limit = n
    return this
  }

  range(from: number, to: number): this {
    this.call.range = [from, to]
    return this
  }

  single(): this {
    return this
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.respond(this.call))
      .then(onfulfilled, onrejected)
  }
}

interface WorldOptions {
  campaignStatus?: string
  recipients?: Array<Partial<RecipientRow>>
  suppressions?: string[]
}

interface World {
  campaign: Row
  recipients: RecipientRow[]
  suppressions: string[]
  /** Erros injetáveis, para simular falha transiente de infraestrutura. */
  failSuppressionLoad: boolean
  failPendingSelect: boolean
  failClaim: boolean
  calls: QueryCall[]
  /** Ganchos disparados antes de a consulta ser respondida. */
  onCall: (call: QueryCall, world: World) => void
  client: { from: (table: string) => FakeQuery }
}

const CAMPAIGN_ID = 'campaign-1'

function createWorld(opts: WorldOptions = {}): World {
  const world = {
    campaign: {
      id: CAMPAIGN_ID,
      nome: 'Campanha',
      status: opts.campaignStatus ?? 'enviando',
      template_key: 'simples',
      subject: 'Assunto',
      preheader: null,
      content: { titulo: 'Olá', texto: 'Corpo do e-mail' },
      cta_label: null,
      cta_url: null,
      audience: { bases: [] },
      total_recipients: (opts.recipients ?? []).length,
      error: null,
    } as Row,
    recipients: (opts.recipients ?? []).map((r, i) => ({
      id: r.id ?? `r${String(i + 1).padStart(4, '0')}`,
      campaign_id: CAMPAIGN_ID,
      email: r.email ?? `pessoa${i + 1}@exemplo.com`,
      nome: r.nome ?? `Pessoa ${i + 1}`,
      status: r.status ?? 'pendente',
      sent_at: r.sent_at ?? null,
      error: r.error ?? null,
      resend_email_id: r.resend_email_id ?? null,
    })),
    suppressions: opts.suppressions ?? [],
    failSuppressionLoad: false,
    failPendingSelect: false,
    failClaim: false,
    calls: [] as QueryCall[],
    onCall: () => {},
  } as unknown as World

  const respond = (call: QueryCall): QueryResult => {
    world.calls.push(call)
    world.onCall(call, world)

    if (call.table === 'email_campaigns') {
      if (call.action === 'select') {
        return { data: { ...world.campaign }, error: null }
      }
      if (call.action === 'update') {
        // O guard `.eq('status', ...)` é a proteção contra sobrescrever um
        // cancelamento: se não casar, o UPDATE não pega nenhuma linha.
        if (!matchesAll(world.campaign, call.filters)) return { data: [], error: null }
        Object.assign(world.campaign, call.payload)
        return { data: [{ ...world.campaign }], error: null }
      }
    }

    if (call.table === 'email_campaign_recipients') {
      if (call.action === 'select') {
        if (call.head) {
          if (world.failPendingSelect) {
            return { data: null, count: null, error: { message: 'count indisponível' } }
          }
          return {
            data: null,
            count: world.recipients.filter((r) => matchesAll(r, call.filters)).length,
            error: null,
          }
        }
        if (world.failPendingSelect) {
          return { data: null, error: { message: 'select indisponível' } }
        }
        let rows = world.recipients.filter((r) => matchesAll(r, call.filters))
        if (call.orders.includes('id')) rows = [...rows].sort((a, b) => a.id.localeCompare(b.id))
        if (call.limit !== null) rows = rows.slice(0, call.limit)
        return { data: rows.map((r) => ({ id: r.id, email: r.email, nome: r.nome })), error: null }
      }
      if (call.action === 'update') {
        const isClaim = call.filters.some((f) => f.op === 'in') && call.payload?.sent_at != null
        if (isClaim && world.failClaim) {
          return { data: null, error: { message: 'reserva indisponível' } }
        }
        const matched = world.recipients.filter((r) => matchesAll(r, call.filters))
        for (const row of matched) Object.assign(row, call.payload)
        return { data: matched.map((r) => ({ id: r.id })), error: null }
      }
      if (call.action === 'upsert') return { data: null, error: null }
    }

    if (call.table === 'email_suppressions') {
      if (world.failSuppressionLoad) {
        return { data: null, error: { message: 'supressão indisponível' } }
      }
      const [from, to] = call.range ?? [0, 999]
      const sorted = [...world.suppressions].sort()
      return { data: sorted.slice(from, to + 1).map((email) => ({ email })), error: null }
    }

    throw new Error(`Consulta inesperada na tabela ${call.table}`)
  }

  world.client = { from: (table: string) => new FakeQuery(table, respond) }
  return world
}

// ---------------------------------------------------------------------------
// Mocks dos módulos externos
// ---------------------------------------------------------------------------

let mockWorld: World = createWorld()

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockWorld.client,
}))

const mockBatchSend = jest.fn()
const mockEmailSend = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    batch: { send: (...args: unknown[]) => mockBatchSend(...args) },
    emails: { send: (...args: unknown[]) => mockEmailSend(...args) },
  })),
}))

import { dispatchSlice, finalizeSlice, type DispatchSliceResult } from '../dispatch'

/** Resposta de sucesso da Resend, no formato do SDK atual. */
function resendOk(count: number) {
  return {
    data: { data: Array.from({ length: count }, (_, i) => ({ id: `resend-${i}` })), errors: [] },
    error: null,
  }
}

function makeRecipients(n: number): Array<Partial<RecipientRow>> {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${String(i + 1).padStart(4, '0')}`,
    email: `pessoa${i + 1}@exemplo.com`,
  }))
}

/** E-mails que a Resend recebeu, achatados de todas as chamadas de lote. */
function sentEmails(): string[] {
  return mockBatchSend.mock.calls.flatMap((call) => {
    const payload = call[0] as Array<{ to: string[] }>
    return payload.map((p) => p.to[0])
  })
}

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://exemplo.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_API_KEY: 're_teste',
  EMAIL_FROM: 'Somma <nao-responda@sommaclub.com.br>',
  NEXT_PUBLIC_APP_URL: 'https://painel.sommaclub.com.br',
  SESSION_SECRET: 'segredo-de-teste',
}

let consoleError: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  for (const [key, value] of Object.entries(ENV)) process.env[key] = value
  mockBatchSend.mockImplementation((payload: unknown[]) => resendOk(payload.length))
  // O módulo loga alto em cada aborto — é intencional em produção e só ruído aqui.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

// ---------------------------------------------------------------------------
// Controle positivo: o caminho feliz precisa funcionar, senão os testes de
// aborto passariam por acidente.
// ---------------------------------------------------------------------------

describe('dispatchSlice — caminho feliz', () => {
  it('envia todos os pendentes, marca enviado e encerra a campanha', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(3) })

    const result = await dispatchSlice(CAMPAIGN_ID)
    await finalizeSlice(CAMPAIGN_ID, result)

    expect(result.ok).toBe(true)
    expect(result.sent).toBe(3)
    expect(result.remaining).toBe(0)
    expect(sentEmails()).toEqual([
      'pessoa1@exemplo.com',
      'pessoa2@exemplo.com',
      'pessoa3@exemplo.com',
    ])
    expect(mockWorld.recipients.every((r) => r.status === 'enviado')).toBe(true)
    expect(mockWorld.campaign.status).toBe('enviada')
  })
})

// ---------------------------------------------------------------------------
// C1 — reserva atômica
// ---------------------------------------------------------------------------

describe('C1 — reserva atômica do lote', () => {
  it('envia apenas para as linhas que a reserva devolveu', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(3) })

    // Simula a execução concorrente: entre o SELECT dos pendentes e o UPDATE de
    // reserva, outro processo reserva a linha do meio. O UPDATE condicional
    // (`.is('sent_at', null)`) deixa de casar com ela e ela não volta no
    // RETURNING — logo, esta execução não pode enviar para ela.
    let claimed = false
    mockWorld.onCall = (call, world) => {
      const isClaim =
        call.table === 'email_campaign_recipients' &&
        call.action === 'update' &&
        call.filters.some((f) => f.op === 'in')
      if (isClaim && !claimed) {
        claimed = true
        const row = world.recipients.find((r) => r.id === 'r0002')
        if (row) row.sent_at = new Date().toISOString()
      }
    }

    const result = await dispatchSlice(CAMPAIGN_ID)

    expect(sentEmails()).toEqual(['pessoa1@exemplo.com', 'pessoa3@exemplo.com'])
    expect(result.sent).toBe(2)
    // A linha da outra execução continua dela: intacta, não marcada como falha.
    const disputed = mockWorld.recipients.find((r) => r.id === 'r0002')
    expect(disputed?.status).toBe('pendente')
    expect(disputed?.error).toBeNull()
  })

  it('ignora pendentes já reservados por outra execução e devolve reservas órfãs à fila', async () => {
    const agora = new Date()
    const recente = new Date(agora.getTime() - 60 * 1000).toISOString() // reserva viva
    const antiga = new Date(agora.getTime() - 30 * 60 * 1000).toISOString() // órfã (> 15 min)

    mockWorld = createWorld({
      recipients: [
        { id: 'r0001', email: 'livre@exemplo.com' },
        { id: 'r0002', email: 'reservado-agora@exemplo.com', sent_at: recente },
        { id: 'r0003', email: 'reserva-orfa@exemplo.com', sent_at: antiga },
      ],
    })

    const result = await dispatchSlice(CAMPAIGN_ID)

    // A reserva viva de outra execução é respeitada; a órfã volta para a fila.
    expect(sentEmails().sort()).toEqual(['livre@exemplo.com', 'reserva-orfa@exemplo.com'])
    expect(mockWorld.recipients.find((r) => r.id === 'r0002')?.status).toBe('pendente')
    expect(result.remaining).toBe(1)
  })

  it('seleciona os pendentes em ordem determinística e ignora os reservados', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(2) })

    await dispatchSlice(CAMPAIGN_ID)

    const pendingSelect = mockWorld.calls.find(
      (c) => c.table === 'email_campaign_recipients' && c.action === 'select' && !c.head,
    )
    expect(pendingSelect?.orders).toContain('id')
    expect(pendingSelect?.filters).toContainEqual({ op: 'is', column: 'sent_at', value: null })
  })

  it('aborta a fatia sem enviar quando a reserva falha', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(2) })
    mockWorld.failClaim = true

    const result = await dispatchSlice(CAMPAIGN_ID)
    await finalizeSlice(CAMPAIGN_ID, result)

    expect(mockBatchSend).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(mockWorld.recipients.every((r) => r.status === 'pendente')).toBe(true)
    expect(mockWorld.campaign.status).toBe('enviando')
  })
})

// ---------------------------------------------------------------------------
// C2 — supressão indisponível
// ---------------------------------------------------------------------------

describe('C2 — lista de supressão indisponível', () => {
  it('deixa as linhas pendente em vez de marcá-las falha', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(5) })
    mockWorld.failSuppressionLoad = true

    const result = await dispatchSlice(CAMPAIGN_ID)
    await finalizeSlice(CAMPAIGN_ID, result)

    expect(mockBatchSend).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/supress/i)

    for (const row of mockWorld.recipients) {
      expect(row.status).toBe('pendente')
      // Nenhuma linha pode carregar a razão falsa "suprimido antes do envio".
      expect(row.error).toBeNull()
      // E a reserva foi devolvida: a fatia seguinte pode pegá-las de novo.
      expect(row.sent_at).toBeNull()
    }

    // A campanha continua 'enviando' — o cron retoma na próxima execução.
    expect(result.remaining).toBe(5)
    expect(mockWorld.campaign.status).toBe('enviando')
  })

  it('continua marcando falha quem está de fato suprimido', async () => {
    mockWorld = createWorld({
      recipients: makeRecipients(2),
      suppressions: ['pessoa2@exemplo.com'],
    })

    const result = await dispatchSlice(CAMPAIGN_ID)

    expect(sentEmails()).toEqual(['pessoa1@exemplo.com'])
    expect(mockWorld.recipients.find((r) => r.id === 'r0002')?.status).toBe('falha')
    expect(mockWorld.recipients.find((r) => r.id === 'r0002')?.error).toBe('suprimido antes do envio')
    expect(result.failed).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// C3 — falha precoce não pode virar "campanha concluída"
// ---------------------------------------------------------------------------

describe('C3 — falha precoce não encerra a campanha', () => {
  it.each(['RESEND_API_KEY', 'EMAIL_FROM', 'NEXT_PUBLIC_APP_URL'])(
    'sinaliza falha fatal quando falta %s, sem marcar enviada',
    async (variable) => {
      mockWorld = createWorld({ recipients: makeRecipients(3) })
      delete process.env[variable]

      const result = await dispatchSlice(CAMPAIGN_ID)
      await finalizeSlice(CAMPAIGN_ID, result)

      expect(result.ok).toBe(false)
      expect(result.fatal).toBe(true)
      expect(result.error).toContain(variable)
      expect(mockBatchSend).not.toHaveBeenCalled()
      // `remaining` é 0 nesse retorno — o que quebrava antes. O que encerra a
      // campanha agora é `ok`, não `remaining`.
      expect(result.remaining).toBe(0)
      expect(mockWorld.campaign.status).not.toBe('enviada')
      expect(mockWorld.campaign.status).toBe('erro')
      expect(mockWorld.recipients.every((r) => r.status === 'pendente')).toBe(true)
    },
  )

  it('não encerra a campanha quando o select dos pendentes falha', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(3) })
    mockWorld.failPendingSelect = true

    const result = await dispatchSlice(CAMPAIGN_ID)
    await finalizeSlice(CAMPAIGN_ID, result)

    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
    expect(mockWorld.campaign.status).toBe('enviando')
    expect(mockWorld.recipients.every((r) => r.status === 'pendente')).toBe(true)
  })

  it('não encerra a campanha quando a campanha não pôde ser lida', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(1) })
    mockWorld.onCall = (call) => {
      if (call.table === 'email_campaigns' && call.action === 'select') {
        throw new Error('campanha indisponível')
      }
    }

    // getCampaign trata o erro internamente; a exceção do fake vira rejeição da
    // consulta, então o comportamento observável é o mesmo: nada é enviado.
    await expect(dispatchSlice(CAMPAIGN_ID)).rejects.toThrow()
    expect(mockBatchSend).not.toHaveBeenCalled()
  })

  it('finalizeSlice não encerra a campanha enquanto sobrar pendente', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(1) })
    const result: DispatchSliceResult = {
      ok: true,
      sent: 100,
      failed: 0,
      remaining: 42,
      fatal: false,
      canceled: false,
      error: null,
    }

    await finalizeSlice(CAMPAIGN_ID, result)

    expect(mockWorld.campaign.status).toBe('enviando')
  })
})

// ---------------------------------------------------------------------------
// C4 — cancelamento é freio de emergência
// ---------------------------------------------------------------------------

describe('C4 — cancelamento interrompe o disparo', () => {
  it('para nos lotes seguintes quando a campanha é cancelada no meio', async () => {
    // 150 destinatários = 2 lotes de envio (BATCH_SIZE = 100).
    mockWorld = createWorld({ recipients: makeRecipients(150) })

    // O operador aperta "cancelar" enquanto o primeiro lote está na rua.
    mockBatchSend.mockImplementation((payload: unknown[]) => {
      mockWorld.campaign.status = 'cancelada'
      return resendOk(payload.length)
    })

    const result = await dispatchSlice(CAMPAIGN_ID)
    await finalizeSlice(CAMPAIGN_ID, result)

    expect(mockBatchSend).toHaveBeenCalledTimes(1)
    expect(sentEmails()).toHaveLength(100)
    expect(result.canceled).toBe(true)
    expect(result.ok).toBe(false)

    // Os 50 do segundo lote não saíram e continuam intactos.
    const naoEnviados = mockWorld.recipients.filter((r) => r.status === 'pendente')
    expect(naoEnviados).toHaveLength(50)
    expect(naoEnviados.every((r) => r.sent_at === null)).toBe(true)

    // E o cancelamento não foi sobrescrito pela finalização.
    expect(mockWorld.campaign.status).toBe('cancelada')
  })

  it('não envia nada quando a campanha já não está em disparo', async () => {
    mockWorld = createWorld({ recipients: makeRecipients(3), campaignStatus: 'cancelada' })

    const result = await dispatchSlice(CAMPAIGN_ID)

    expect(mockBatchSend).not.toHaveBeenCalled()
    expect(result.canceled).toBe(true)
    expect(result.ok).toBe(false)
    expect(mockWorld.recipients.every((r) => r.status === 'pendente')).toBe(true)
  })

  it('a transição para enviada não sobrescreve uma campanha cancelada', async () => {
    mockWorld = createWorld({ recipients: [], campaignStatus: 'cancelada' })
    const concluida: DispatchSliceResult = {
      ok: true,
      sent: 10,
      failed: 0,
      remaining: 0,
      fatal: false,
      canceled: false,
      error: null,
    }

    await finalizeSlice(CAMPAIGN_ID, concluida)

    expect(mockWorld.campaign.status).toBe('cancelada')
    // O guard está na consulta, não só no fake.
    const update = mockWorld.calls.find(
      (c) => c.table === 'email_campaigns' && c.action === 'update',
    )
    expect(update?.filters).toContainEqual({ op: 'eq', column: 'status', value: 'enviando' })
  })

  it('a transição para erro também respeita o cancelamento', async () => {
    mockWorld = createWorld({ recipients: [], campaignStatus: 'cancelada' })
    const fatal: DispatchSliceResult = {
      ok: false,
      sent: 0,
      failed: 0,
      remaining: 0,
      fatal: true,
      canceled: false,
      error: 'Configuração ausente: RESEND_API_KEY',
    }

    await finalizeSlice(CAMPAIGN_ID, fatal)

    expect(mockWorld.campaign.status).toBe('cancelada')
  })
})
