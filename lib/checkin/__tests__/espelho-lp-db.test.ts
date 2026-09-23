import { espelharForaDaLista, sincronizarInscritosLp } from '../espelho-lp'

/**
 * Cliente Supabase de mentira: cada `from(tabela)` devolve um builder
 * encadeável que resolve com as linhas configuradas; `insert` guarda o que
 * recebeu para a asserção.
 */
function fakeSupabase(tabelas: Record<string, unknown[]>, inseridos: unknown[][] = []) {
  const builder = (tabela: string) => {
    const linhas = tabelas[tabela] ?? []
    const b: Record<string, unknown> = {}
    const chain = () => b
    for (const m of ['select', 'eq', 'neq', 'in', 'order', 'range']) b[m] = chain
    b.maybeSingle = async () => ({ data: linhas[0] ?? null, error: null })
    b.insert = async (rows: unknown[]) => { inseridos.push(rows); return { data: null, error: null } }
    b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: linhas, error: null }).then(resolve)
    return b
  }
  return { from: builder } as unknown as Parameters<typeof espelharForaDaLista>[0]
}

const EVENTO = { id: 'ev1', titulo: 'SOMMA DAY', data_evento: '2026-09-26' }

describe('espelharForaDaLista', () => {
  it('não insere nada quando todo mundo já está na lista', async () => {
    const inseridos: unknown[][] = []
    const sb = fakeSupabase({
      eventos: [EVENTO],
      evento_participantes: [{ id: 'p1', evento_id: 'ev1', pessoa_id: 7, cpf: '12345678901', nome_completo: 'Ana', email: 'a@x.com', telefone: '61999999999', pelotao: '4km', status: 'inscrito', criado_em: '2026-09-23T18:00:00Z' }],
      checkins: [{ cpf: '123.456.789-01' }],
    }, inseridos)
    await expect(espelharForaDaLista(sb, 'ev1')).resolves.toEqual({ inseridos: 0, restantes: 0 })
    expect(inseridos).toHaveLength(0)
  })

  it('insere quem falta, no formato do /api/checkin, com sexo da base de pessoas', async () => {
    const inseridos: unknown[][] = []
    const sb = fakeSupabase({
      eventos: [EVENTO],
      evento_participantes: [
        { id: 'p1', evento_id: 'ev1', pessoa_id: 7, cpf: '12345678901', nome_completo: 'Ana', email: 'a@x.com', telefone: '61999999999', pelotao: '4km', status: 'inscrito', criado_em: '2026-09-23T18:00:00Z' },
        { id: 'p2', evento_id: 'ev1', pessoa_id: 8, cpf: '98765432100', nome_completo: 'Bia', email: null, telefone: null, pelotao: '6km', status: 'inscrito', criado_em: '2026-09-23T18:05:00Z' },
      ],
      checkins: [{ cpf: '98765432100' }],
      cadastro_site: [{ id: 7, sexo: 'feminino' }],
    }, inseridos)
    const r = await espelharForaDaLista(sb, 'ev1')
    expect(r.inseridos).toBe(1)
    expect(inseridos).toHaveLength(1)
    expect(inseridos[0]).toEqual([{
      nome_completo: 'Ana', email: 'a@x.com', telefone: '61999999999', cpf: '12345678901', sexo: 'feminino',
      pelotao: '4km', data_do_evento: '2026-09-26', nome_do_evento: 'SOMMA DAY', evento_id: 'ev1',
      data_hora_checkin: '2026-09-23T18:00:00Z', validacao_do_checkin: false,
    }])
  })

  it('recusa evento inexistente', async () => {
    const sb = fakeSupabase({ eventos: [] })
    await expect(espelharForaDaLista(sb, 'nada')).rejects.toThrow('Evento não encontrado')
  })
})

describe('sincronizarInscritosLp', () => {
  afterEach(() => { delete process.env.CHECKIN_SINCRONIZAR_LP })

  it('não derruba quem chamou quando o banco falha', async () => {
    const sb = { from: () => { throw new Error('banco fora') } } as unknown as Parameters<typeof sincronizarInscritosLp>[0]
    const r = await sincronizarInscritosLp(sb, 'ev-x')
    expect(r.erro).toBe('banco fora')
    expect(r.inseridos).toBe(0)
  })

  it('fica parada com CHECKIN_SINCRONIZAR_LP=off', async () => {
    process.env.CHECKIN_SINCRONIZAR_LP = 'off'
    const sb = { from: () => { throw new Error('não era para chamar') } } as unknown as Parameters<typeof sincronizarInscritosLp>[0]
    await expect(sincronizarInscritosLp(sb, 'ev-y')).resolves.toEqual({ inseridos: 0, restantes: 0 })
  })
})
