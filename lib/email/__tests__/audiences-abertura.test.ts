/**
 * @jest-environment node
 *
 * Cobre `excluir_abertos_de`: a exclusão por abertura que sustenta uma régua
 * de reenvio ("manda só para quem não abriu a etapa anterior").
 *
 * O risco que estes testes guardam é assimétrico. Se a lista de abridores vier
 * curta, a etapa seguinte não parece quebrada: parece uma etapa com mais gente
 * para reenviar, e o mesmo e-mail sai de novo para quem já tinha aberto. Por
 * isso a leitura é fail-closed, e por isso ela olha duas tabelas.
 */

interface Handler {
  (call: { table: string; filters: Array<[string, unknown]>; range: [number, number] }): {
    data: unknown[] | null
    error: { message: string } | null
  }
}

let handler: Handler

function makeQuery(table: string) {
  const filters: Array<[string, unknown]> = []
  let range: [number, number] = [0, 999]

  const builder = {
    select() {
      return builder
    },
    order() {
      return builder
    },
    range(from: number, to: number) {
      range = [from, to]
      return builder
    },
    eq(column: string, value: unknown) {
      filters.push([column, value])
      return builder
    },
    in(column: string, value: unknown) {
      filters.push([column, value])
      return builder
    },
    then(resolve: (r: unknown) => void) {
      resolve(handler({ table, filters, range }))
    },
  }

  return builder
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (table: string) => makeQuery(table) }),
}))

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://exemplo.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolveAudienceDetailed } = require('../audiences') as typeof import('../audiences')

/** Devolve a página 0 com as linhas dadas e páginas vazias depois. */
function pagina(rows: unknown[], range: [number, number]) {
  return { data: range[0] === 0 ? rows : [], error: null }
}

const CAMPANHA_1 = '11111111-1111-4111-8111-111111111111'
const CAMPANHA_2 = '22222222-2222-4222-8222-222222222222'

const BASE = [
  { email: 'ana@x.com', nome_completo: 'Ana' },
  { email: 'bruno@x.com', nome_completo: 'Bruno' },
  { email: 'carla@x.com', nome_completo: 'Carla' },
]

const selecao = (excluir?: string[]) => ({
  bases: [{ key: 'membros' as const, filtros: {} }],
  excluir_abertos_de: excluir,
})

beforeEach(() => {
  handler = ({ table, range }) => {
    if (table === 'cadastro_site') return pagina(BASE, range)
    return pagina([], range)
  }
})

describe('resolveAudienceDetailed com excluir_abertos_de', () => {
  it('tira da audiência quem já abriu a campanha marcada', async () => {
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_recipients') return pagina([{ email: 'bruno@x.com' }], range)
      return pagina([], range)
    }

    const resolved = await resolveAudienceDetailed(selecao([CAMPANHA_1]))

    expect(resolved?.recipients.map((r) => r.email)).toEqual(['ana@x.com', 'carla@x.com'])
    expect(resolved?.excluidosPorAbertura).toBe(1)
  })

  it('une as duas fontes de abertura: status do destinatário e log de eventos', async () => {
    // 'ana' só aparece no snapshot de status; 'carla' só no log append-only.
    // Um evento terminal (bounce/spam) sobrescreve o status 'aberto', então
    // quem confiar só na primeira tabela reenvia para quem já tinha aberto.
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_recipients') return pagina([{ email: 'ana@x.com' }], range)
      if (table === 'email_campaign_events') return pagina([{ email: 'carla@x.com' }], range)
      return pagina([], range)
    }

    const resolved = await resolveAudienceDetailed(selecao([CAMPANHA_1]))

    expect(resolved?.recipients.map((r) => r.email)).toEqual(['bruno@x.com'])
    expect(resolved?.excluidosPorAbertura).toBe(2)
  })

  it('normaliza o e-mail vindo das aberturas antes de comparar', async () => {
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_recipients') return pagina([{ email: '  ANA@X.com ' }], range)
      return pagina([], range)
    }

    const resolved = await resolveAudienceDetailed(selecao([CAMPANHA_1]))

    expect(resolved?.recipients.map((r) => r.email)).toEqual(['bruno@x.com', 'carla@x.com'])
  })

  it('consulta as duas tabelas com todas as campanhas marcadas', async () => {
    const vistos: Array<[string, unknown]> = []
    handler = ({ table, filters, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      for (const f of filters) if (f[0] === 'campaign_id') vistos.push([table, f[1]])
      return pagina([], range)
    }

    await resolveAudienceDetailed(selecao([CAMPANHA_1, CAMPANHA_2]))

    expect(vistos).toEqual(
      expect.arrayContaining([
        ['email_campaign_recipients', [CAMPANHA_1, CAMPANHA_2]],
        ['email_campaign_events', [CAMPANHA_1, CAMPANHA_2]],
      ]),
    )
  })

  it('devolve null quando a lista de abridores não pôde ser lida (fail-closed)', async () => {
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_events') return { data: null, error: { message: 'timeout' } }
      return pagina([], range)
    }

    // Sem isso a etapa sairia para a base inteira, sem sinal nenhum de que o
    // filtro não funcionou.
    await expect(resolveAudienceDetailed(selecao([CAMPANHA_1]))).resolves.toBeNull()
  })

  it('não consulta as tabelas de abertura quando nenhuma campanha foi marcada', async () => {
    const tabelas: string[] = []
    handler = ({ table, range }) => {
      tabelas.push(table)
      if (table === 'cadastro_site') return pagina(BASE, range)
      return pagina([], range)
    }

    const resolved = await resolveAudienceDetailed(selecao())

    expect(resolved?.recipients).toHaveLength(3)
    expect(resolved?.excluidosPorAbertura).toBe(0)
    expect(tabelas).not.toContain('email_campaign_recipients')
    expect(tabelas).not.toContain('email_campaign_events')
  })
})

describe('resolveAudienceDetailed com somente_abertos_de', () => {
  const soEngajados = (ids: string[], excluir?: string[]) => ({
    bases: [{ key: 'membros' as const, filtros: {} }],
    somente_abertos_de: ids,
    excluir_abertos_de: excluir,
  })

  it('mantém só quem abriu ou clicou em alguma das campanhas marcadas', async () => {
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_recipients') return pagina([{ email: 'ana@x.com' }], range)
      if (table === 'email_campaign_events') return pagina([{ email: ' CARLA@x.com' }], range)
      return pagina([], range)
    }

    const resolved = await resolveAudienceDetailed(soEngajados([CAMPANHA_1]))

    expect(resolved?.recipients.map((r) => r.email)).toEqual(['ana@x.com', 'carla@x.com'])
    expect(resolved?.excluidosPorNaoAbertura).toBe(1)
    expect(resolved?.excluidosPorAbertura).toBe(0)
  })

  it('sem nenhuma abertura, a audiência sai vazia em vez de virar a base inteira', async () => {
    const resolved = await resolveAudienceDetailed(soEngajados([CAMPANHA_1]))

    expect(resolved?.recipients).toEqual([])
    expect(resolved?.excluidosPorNaoAbertura).toBe(3)
  })

  it('lista vazia não filtra nada', async () => {
    const resolved = await resolveAudienceDetailed(soEngajados([]))

    expect(resolved?.recipients).toHaveLength(3)
    expect(resolved?.excluidosPorNaoAbertura).toBe(0)
  })

  it('falha fechado se a leitura de aberturas falhar', async () => {
    handler = ({ table, range }) => {
      if (table === 'cadastro_site') return pagina(BASE, range)
      if (table === 'email_campaign_events') return { data: null, error: { message: 'timeout' } }
      return pagina([], range)
    }

    expect(await resolveAudienceDetailed(soEngajados([CAMPANHA_1]))).toBeNull()
  })
})
