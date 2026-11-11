/**
 * @jest-environment node
 */
/**
 * PATCH /api/membros/[id] — edição do cadastro completo.
 *
 * O que estes casos protegem: só campos editáveis chegam ao banco, no formato
 * do site; CPF e e-mail de outra pessoa são recusados com mensagem própria; e
 * a resposta traz a linha inteira, que a tela usa para se atualizar.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-membros-editar'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'

import { NextRequest } from 'next/server'

type Chamada = { op: string; payload?: unknown; filtros: Array<[string, string, unknown]> }

const mundo = {
  linha: null as Record<string, unknown> | null,
  emailDeOutro: null as { id: number } | null,
  erroUpdate: null as { code: string; message: string } | null,
  chamadas: [] as Chamada[],
}

function construtor() {
  const c: Chamada = { op: 'select', filtros: [] }
  const b: Record<string, unknown> = {}
  b.select = () => b
  b.limit = () => b
  b.update = (p: unknown) => {
    c.op = 'update'
    c.payload = p
    return b
  }
  for (const f of ['eq', 'neq', 'ilike']) {
    b[f] = (col: string, v: unknown) => {
      c.filtros.push([f, col, v])
      return b
    }
  }
  const fim = async () => {
    mundo.chamadas.push(c)
    if (c.op === 'update') {
      if (mundo.erroUpdate) return { data: null, error: mundo.erroUpdate }
      if (!mundo.linha) return { data: [], error: null }
      mundo.linha = { ...mundo.linha, ...(c.payload as object) }
      return { data: [mundo.linha], error: null }
    }
    // select de e-mail duplicado
    return { data: mundo.emailDeOutro ? [mundo.emailDeOutro] : [], error: null }
  }
  b.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => fim().then(ok, erro)
  return b
}

jest.mock('@/lib/auth/api-auth', () => ({
  ...jest.requireActual('@/lib/auth/api-auth'),
  requirePermission: async () => ({
    session: { sub: 'u-1', email: 'alex@somma.run', full_name: 'Alex', role: 'admin', permissions: null, exp: 0 },
  }),
  getAdminClient: () => ({ from: () => construtor() }),
}))

function patch(id: string, body: unknown) {
  return new NextRequest(`https://admin.sommaclub.com.br/api/membros/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  mundo.linha = {
    id: 7,
    nome_completo: 'Ana Souza',
    email: 'ana@exemplo.com',
    cpf: '529.982.247-25',
    data_nascimento: '10/05/1990',
    whatsapp: '61999998888',
    cep: null,
    sexo: null,
    data_de_cadastro: '2026-03-02T14:05:09-03:00',
    cpf_digits: '52998224725',
  }
  mundo.emailDeOutro = null
  mundo.erroUpdate = null
  mundo.chamadas = []
  jest.resetModules()
})

async function rota() {
  return (await import('../membros/[id]/route')).PATCH
}

describe('PATCH /api/membros/[id]', () => {
  it('grava só os campos enviados, no formato do site, e devolve a linha inteira', async () => {
    const PATCH = await rota()
    const res = await PATCH(patch('7', { cep: '70000000', sexo: 'feminino', whatsapp: '61 98888 7777' }), params('7'))
    expect(res.status).toBe(200)

    const update = mundo.chamadas.find((c) => c.op === 'update')!
    expect(update.payload).toEqual({ cep: '70000-000', sexo: 'feminino', whatsapp: '(61) 98888-7777' })
    expect(update.filtros).toContainEqual(['eq', 'id', 7])

    const { data } = await res.json()
    // Campo que ninguém mexeu continua no formato antigo.
    expect(data).toMatchObject({ id: 7, cep: '70000-000', data_nascimento: '10/05/1990', cpf_digits: '52998224725' })
  })

  it('ignora id e cpf_digits no corpo', async () => {
    const PATCH = await rota()
    const res = await PATCH(patch('7', { id: 1, cpf_digits: '000', nome_completo: 'Ana S.' }), params('7'))
    expect(res.status).toBe(200)
    expect(mundo.chamadas.find((c) => c.op === 'update')!.payload).toEqual({ nome_completo: 'Ana S.' })
  })

  it('recusa campo inválido com 400 e o nome do campo, sem tocar no banco', async () => {
    const PATCH = await rota()
    const res = await PATCH(patch('7', { cpf: '111.111.111-11' }), params('7'))
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ campo: 'cpf' })
    expect(mundo.chamadas).toHaveLength(0)
  })

  it('CPF que já é de outro membro: 409 com mensagem própria', async () => {
    mundo.erroUpdate = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const PATCH = await rota()
    const res = await PATCH(patch('7', { cpf: '52998224725' }), params('7'))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Este CPF já pertence a outro membro.', campo: 'cpf' })
  })

  it('e-mail de outro cadastro: 409, e a busca exclui o próprio membro', async () => {
    mundo.emailDeOutro = { id: 42 }
    const PATCH = await rota()
    const res = await PATCH(patch('7', { email: 'Outra@Exemplo.com' }), params('7'))
    expect(res.status).toBe(409)
    expect((await res.json()).campo).toBe('email')

    const busca = mundo.chamadas[0]
    expect(busca.filtros).toContainEqual(['ilike', 'email', 'outra@exemplo.com'])
    expect(busca.filtros).toContainEqual(['neq', 'id', 7])
    expect(mundo.chamadas.some((c) => c.op === 'update')).toBe(false)
  })

  it('escapa curingas do ilike no e-mail', async () => {
    const PATCH = await rota()
    await PATCH(patch('7', { email: 'a_b@exemplo.com' }), params('7'))
    expect(mundo.chamadas[0].filtros).toContainEqual(['ilike', 'email', 'a\\_b@exemplo.com'])
  })

  it('membro inexistente: 404', async () => {
    mundo.linha = null
    const PATCH = await rota()
    const res = await PATCH(patch('7', { cep: '70000000' }), params('7'))
    expect(res.status).toBe(404)
  })

  it('corpo vazio ou id inválido: 400', async () => {
    const PATCH = await rota()
    expect((await PATCH(patch('7', {}), params('7'))).status).toBe(400)
    expect((await PATCH(patch('abc', { cep: '70000000' }), params('abc'))).status).toBe(400)
  })
})
