/**
 * @jest-environment node
 */
/**
 * Cadastro de operadores do PDV.
 *
 * O que estes casos protegem: o cadastro toca três lugares (Auth, admin_roles,
 * pos_operators) e não pode deixar nenhum pela metade; o código volta uma vez
 * e nunca fica gravado no cadastro; e o mesmo CPF não ganha dois acessos.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-operadores'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'

import { NextRequest } from 'next/server'

const CPF_VALIDO = '52998224725'
const USER_ID = '11111111-1111-4111-8111-111111111111'
const OPERADOR_ID = '22222222-2222-4222-8222-222222222222'
const INSIDER_ID = '33333333-3333-4333-8333-333333333333'

type Consulta = {
  tabela: string
  op: 'select' | 'insert' | 'update' | 'delete'
  payload: unknown
  filtros: Array<[string, unknown]>
}

const mundo = {
  operadores: [] as Array<Record<string, unknown>>,
  membros: [] as Array<{ nome_completo: string }>,
  insiders: [] as Array<Record<string, unknown>>,
  falharInsertOperador: false,
  consultas: [] as Consulta[],
  authUsuarios: [] as Array<{ id: string; email: string; password: string }>,
  authApagados: [] as string[],
}

function resolver(c: Consulta): { data: unknown; error: unknown } {
  if (c.tabela === 'pos_operators') {
    if (c.op === 'select') {
      const porCpf = c.filtros.find(([col]) => col === 'cpf')
      const linhas = porCpf ? mundo.operadores.filter((o) => o.cpf === porCpf[1]) : mundo.operadores
      // `.maybeSingle()` e `.single()` esperam um objeto; a listagem, um array.
      return { data: porCpf ? (linhas[0] ?? null) : linhas, error: null }
    }
    if (c.op === 'insert') {
      if (mundo.falharInsertOperador) return { data: null, error: { message: 'boom' } }
      const linha = {
        id: OPERADOR_ID,
        active: true,
        code_issued_at: '2026-09-25T12:00:00Z',
        created_at: '2026-09-25T12:00:00Z',
        ...(c.payload as Record<string, unknown>),
      }
      mundo.operadores.push(linha)
      return { data: linha, error: null }
    }
  }
  if (c.tabela === 'cadastro_site') return { data: mundo.membros, error: null }
  if (c.tabela === 'checkins') return { data: [], error: null }
  if (c.tabela === 'dados_insiders') return { data: mundo.insiders, error: null }
  return { data: null, error: null }
}

function construtor(tabela: string) {
  const estado: Consulta = { tabela, op: 'select', payload: undefined, filtros: [] }
  const b: Record<string, unknown> = {}
  const encadeia = () => b
  b.select = encadeia
  b.order = encadeia
  b.limit = encadeia
  b.eq = (col: string, v: unknown) => {
    estado.filtros.push([col, v])
    return b
  }
  b.in = (col: string, v: unknown) => {
    estado.filtros.push([col, v])
    return b
  }
  b.insert = (p: unknown) => {
    estado.op = 'insert'
    estado.payload = p
    return b
  }
  b.update = (p: unknown) => {
    estado.op = 'update'
    estado.payload = p
    return b
  }
  b.delete = () => {
    estado.op = 'delete'
    return b
  }
  const finaliza = async () => {
    mundo.consultas.push({ ...estado, filtros: [...estado.filtros] })
    return resolver(estado)
  }
  b.single = finaliza
  b.maybeSingle = finaliza
  b.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => finaliza().then(ok, erro)
  return b
}

const authAdmin = {
  createUser: jest.fn(async (p: { email: string; password: string }) => {
    mundo.authUsuarios.push({ id: USER_ID, ...p })
    return { data: { user: { id: USER_ID } }, error: null }
  }),
  deleteUser: jest.fn(async (id: string) => {
    mundo.authApagados.push(id)
    return { data: {}, error: null }
  }),
  updateUserById: jest.fn(async () => ({ data: {}, error: null })),
  getUserById: jest.fn(async () => ({
    data: { user: { id: USER_ID, last_sign_in_at: '2026-09-24T18:00:00Z' } },
    error: null,
  })),
}

jest.mock('@/lib/auth/api-auth', () => ({
  ...jest.requireActual('@/lib/auth/api-auth'),
  requirePermission: async () => ({
    session: { sub: 'u-1', email: 'alex@somma.run', full_name: 'Alex', role: 'admin', permissions: null, exp: 0 },
  }),
  getAdminClient: () => ({ from: construtor, auth: { admin: authAdmin } }),
}))

function post(body: unknown): NextRequest {
  return new NextRequest('https://admin.sommaclub.com.br/api/pdv/operadores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mundo.operadores = []
  mundo.membros = []
  mundo.insiders = []
  mundo.falharInsertOperador = false
  mundo.consultas = []
  mundo.authUsuarios = []
  mundo.authApagados = []
  jest.clearAllMocks()
  jest.resetModules()
})

describe('POST /api/pdv/operadores', () => {
  it('cria usuário no Auth, papel operator e cadastro; devolve o código uma vez', async () => {
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: '529.982.247-25', nome: 'Ana Souza' }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.codigo).toMatch(/^[A-Z2-9]{8}$/)
    expect(body.operador).toMatchObject({ cpf: CPF_VALIDO, nome: 'Ana Souza', ativo: true, insider: false })
    expect(JSON.stringify(body.operador)).not.toContain(body.codigo)

    // O usuário do Auth nasce com o e-mail sintético e o código como senha.
    expect(authAdmin.createUser).toHaveBeenCalledTimes(1)
    expect(mundo.authUsuarios[0]).toMatchObject({
      email: `${CPF_VALIDO}@pdv.sommaclub.com.br`,
      password: body.codigo,
    })

    const papel = mundo.consultas.find((c) => c.tabela === 'admin_roles' && c.op === 'insert')
    expect(papel?.payload).toMatchObject({ user_id: USER_ID, role: 'operator' })

    expect(mundo.operadores[0]).toMatchObject({ cpf: CPF_VALIDO, user_id: USER_ID, created_by: 'alex@somma.run' })
    expect(mundo.authApagados).toEqual([])
  })

  it('desfaz o usuário do Auth e o papel quando o cadastro falha', async () => {
    mundo.falharInsertOperador = true
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO, nome: 'Ana Souza' }))
    expect(res.status).toBe(500)

    expect(mundo.authApagados).toEqual([USER_ID])
    const apagouPapel = mundo.consultas.some(
      (c) => c.tabela === 'admin_roles' && c.op === 'delete' && c.filtros.some(([col, v]) => col === 'user_id' && v === USER_ID)
    )
    expect(apagouPapel).toBe(true)
  })

  it('recusa CPF inválido sem tocar no Auth', async () => {
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: '123.456.789-00', nome: 'Ana' }))
    expect(res.status).toBe(400)
    expect(authAdmin.createUser).not.toHaveBeenCalled()
  })

  it('recusa CPF que já tem acesso, sem criar segundo usuário', async () => {
    mundo.operadores.push({ id: OPERADOR_ID, cpf: CPF_VALIDO, name: 'Ana', user_id: USER_ID, active: true })
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO, nome: 'Ana' }))
    expect(res.status).toBe(409)
    expect(authAdmin.createUser).not.toHaveBeenCalled()
  })

  it('Insider: libera sem código, vincula o registro Insider e usa segredo interno no Auth', async () => {
    mundo.insiders = [
      { id: INSIDER_ID, cpf: '529.982.247-25', nome: 'Ana Insider', ativo: true, criado_em: '2026-08-10T12:00:00Z', insider_credentials: { senha_hash: '$2b$12$hash' } },
    ]
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.codigo).toBeNull()
    expect(body.operador).toMatchObject({ nome: 'Ana Insider', insider: true })

    // O usuário do Auth existe (o PDV abre a sessão por ele), mas a senha não é
    // um código de 8 caracteres que alguém possa ter visto.
    expect(mundo.authUsuarios[0]?.password).toHaveLength(32)
    // O vínculo é o que o PDV confere no login por senha do Insider.
    expect(mundo.operadores[0]).toMatchObject({ insider_id: INSIDER_ID })
  })

  it('com a chave do acesso Insider desligada, gera código e não vincula', async () => {
    mundo.insiders = [
      { id: INSIDER_ID, cpf: '529.982.247-25', nome: 'Ana Insider', ativo: true, insider_credentials: { senha_hash: '$2b$12$hash' } },
    ]
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO, acesso_insider: false }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.codigo).toMatch(/^[A-Z2-9]{8}$/)
    expect(body.operador.insider).toBe(false)
    expect(mundo.operadores[0]).toMatchObject({ insider_id: null })
  })

  it('Insider sem senha no Insider Connect também entra só com o CPF', async () => {
    mundo.insiders = [{ id: INSIDER_ID, cpf: '529.982.247-25', nome: 'Ana Insider', ativo: true }]
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.codigo).toBeNull()
    expect(body.operador).toMatchObject({ nome: 'Ana Insider', insider: true })
    expect(mundo.operadores[0]).toMatchObject({ insider_id: INSIDER_ID })
  })

  it('Insider inativo recebe código e não é vinculado', async () => {
    mundo.insiders = [{ id: INSIDER_ID, cpf: '529.982.247-25', nome: 'Ana Insider', ativo: false }]
    const { POST } = await import('../pdv/operadores/route')
    const res = await POST(post({ cpf: CPF_VALIDO }))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.codigo).toMatch(/^[A-Z2-9]{8}$/)
    expect(body.operador.insider).toBe(false)
    expect(mundo.operadores[0]).toMatchObject({ insider_id: null })
  })

  it('sem nome, usa o da base do clube; fora da base, pede o nome', async () => {
    const { POST } = await import('../pdv/operadores/route')

    const semBase = await POST(post({ cpf: CPF_VALIDO }))
    expect(semBase.status).toBe(400)
    expect((await semBase.json()).code).toBe('nome_obrigatorio')
    expect(authAdmin.createUser).not.toHaveBeenCalled()

    mundo.membros = [{ nome_completo: 'Ana da Base' }]
    const comBase = await POST(post({ cpf: CPF_VALIDO }))
    expect(comBase.status).toBe(201)
    expect((await comBase.json()).operador.nome).toBe('Ana da Base')
  })
})

describe('GET /api/pdv/operadores', () => {
  it('lista com o último acesso vindo do Auth e sem expor o user_id', async () => {
    mundo.operadores.push({
      id: OPERADOR_ID,
      cpf: CPF_VALIDO,
      name: 'Ana',
      user_id: USER_ID,
      active: true,
      code_issued_at: '2026-09-25T12:00:00Z',
      created_by: 'alex@somma.run',
      created_at: '2026-09-25T12:00:00Z',
    })
    const { GET } = await import('../pdv/operadores/route')
    const res = await GET(new NextRequest('https://admin.sommaclub.com.br/api/pdv/operadores'))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.operadores).toHaveLength(1)
    expect(body.operadores[0]).toMatchObject({
      id: OPERADOR_ID,
      nome: 'Ana',
      ultimo_acesso_em: '2026-09-24T18:00:00Z',
      insider: false,
    })
    expect(body.operadores[0]).not.toHaveProperty('user_id')
  })

  function operadorNaLista(insiderId: string | null) {
    mundo.operadores.push({
      id: OPERADOR_ID,
      cpf: CPF_VALIDO,
      name: 'Ana',
      user_id: USER_ID,
      active: true,
      code_issued_at: '2026-09-25T12:00:00Z',
      created_by: 'alex@somma.run',
      created_at: '2026-09-25T12:00:00Z',
      insider_id: insiderId,
    })
  }

  it('marca como Insider quem foi vinculado ao registro Insider atual', async () => {
    operadorNaLista(INSIDER_ID)
    mundo.insiders = [{ id: INSIDER_ID, cpf: '529.982.247-25', nome: 'Ana', ativo: true, insider_credentials: [{ senha_hash: '$2b$12$x' }] }]
    const { GET } = await import('../pdv/operadores/route')
    const res = await GET(new NextRequest('https://admin.sommaclub.com.br/api/pdv/operadores'))
    const body = await res.json()
    expect(body.operadores[0].insider).toBe(true)
  })

  it('não marca como Insider um registro Insider criado depois da liberação (sem vínculo ou outro id)', async () => {
    mundo.insiders = [{ id: 'outro-insider', cpf: '529.982.247-25', nome: 'Ana', ativo: true, insider_credentials: [{ senha_hash: '$2b$12$x' }] }]
    const { GET } = await import('../pdv/operadores/route')

    operadorNaLista(null)
    let body = await (await GET(new NextRequest('https://admin.sommaclub.com.br/api/pdv/operadores'))).json()
    expect(body.operadores[0].insider).toBe(false)

    mundo.operadores = []
    operadorNaLista(INSIDER_ID)
    body = await (await GET(new NextRequest('https://admin.sommaclub.com.br/api/pdv/operadores'))).json()
    expect(body.operadores[0].insider).toBe(false)
  })
})
