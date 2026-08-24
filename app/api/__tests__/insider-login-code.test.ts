/**
 * @jest-environment node
 */
/**
 * Login do Insider por código enviado ao e-mail.
 *
 * O que estes casos protegem: a rota pública não pode virar um verificador de
 * "esse CPF é Insider?", o código não pode ser reutilizado, e a força bruta
 * sobre 6 dígitos tem que esbarrar no teto de tentativas.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-codigo'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'
process.env.RESEND_API_KEY = 'chave-de-teste'
process.env.EMAIL_FROM = 'somma@exemplo.com'

import { NextRequest } from 'next/server'
import { MAX_TENTATIVAS } from '@/lib/insider/login-code'

const CPF_VALIDO = '529.982.247-25'

const mundo = {
  insider: { id: 'i-1', cpf: CPF_VALIDO, nome: 'Alex', email: 'alex@exemplo.com', ativo: true } as
    | Record<string, unknown>
    | null,
  codigos: [] as Array<Record<string, unknown>>,
  inseridos: [] as Array<Record<string, unknown>>,
  atualizacoes: [] as Array<Record<string, unknown>>,
}

const enviados: Array<{ to: string; html: string }> = []
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: async (payload: { to: string; html: string }) => {
        enviados.push(payload)
        return { error: null }
      },
    },
  })),
}))

// Encadeamento mínimo do supabase-js usado pelas duas rotas.
function query(tabela: string) {
  const builder: Record<string, unknown> = {}
  const encadeia = () => builder
  for (const m of ['select', 'eq', 'in', 'is', 'lt', 'order', 'delete', 'update', 'insert']) {
    builder[m] = jest.fn((arg?: unknown) => {
      if (m === 'insert') mundo.inseridos.push(arg as Record<string, unknown>)
      if (m === 'update') mundo.atualizacoes.push(arg as Record<string, unknown>)
      return encadeia()
    })
  }
  builder.limit = jest.fn(async () => {
    if (tabela === 'dados_insiders') return { data: mundo.insider ? [mundo.insider] : [], error: null }
    return { data: mundo.codigos, error: null }
  })
  // `.select()` terminal depois de update, usado no consumo do código.
  builder.then = undefined
  return builder as never
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (tabela: string) => query(tabela) }),
}))

function post(url: string, body: unknown, comOrigin = true): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    host: 'admin.sommaclub.com.br',
  }
  if (comOrigin) headers.origin = 'https://admin.sommaclub.com.br'
  return new NextRequest(url, { method: 'POST', headers, body: JSON.stringify(body) })
}

const URL_CODIGO = 'https://admin.sommaclub.com.br/api/insiders/codigo'
const URL_ENTRAR = 'https://admin.sommaclub.com.br/api/insiders/entrar-codigo'

beforeEach(() => {
  mundo.insider = { id: 'i-1', cpf: CPF_VALIDO, nome: 'Alex', email: 'alex@exemplo.com', ativo: true }
  mundo.codigos = []
  mundo.inseridos = []
  mundo.atualizacoes = []
  enviados.length = 0
  jest.resetModules()
})

describe('POST /api/insiders/codigo', () => {
  it('recusa requisição de outra origem', async () => {
    const { POST } = await import('../insiders/codigo/route')
    const res = await POST(post(URL_CODIGO, { cpf: CPF_VALIDO }, false))
    expect(res.status).toBe(403)
  })

  it('recusa CPF inválido antes de tocar o banco', async () => {
    const { POST } = await import('../insiders/codigo/route')
    const res = await POST(post(URL_CODIGO, { cpf: '111.111.111-11' }))
    expect(res.status).toBe(400)
    expect(enviados).toHaveLength(0)
  })

  it('guarda apenas o hash do código, nunca o texto', async () => {
    const { POST } = await import('../insiders/codigo/route')
    await POST(post(URL_CODIGO, { cpf: CPF_VALIDO }))

    const gravado = mundo.inseridos.at(-1) as { codigo_hash: string }
    expect(gravado.codigo_hash).toMatch(/^\$2[aby]\$/)

    // O código que foi para o e-mail não pode aparecer em texto no banco.
    const codigoEnviado = enviados[0].html.match(/>(\d{6})</)?.[1]
    expect(codigoEnviado).toMatch(/^\d{6}$/)
    expect(JSON.stringify(mundo.inseridos)).not.toContain(codigoEnviado)
  })

  it('devolve o e-mail mascarado, nunca o endereço inteiro', async () => {
    const { POST } = await import('../insiders/codigo/route')
    const res = await POST(post(URL_CODIGO, { cpf: CPF_VALIDO }))
    const body = await res.json()

    expect(body.enviado_para).toBe('a***@exemplo.com')
    expect(JSON.stringify(body)).not.toContain('alex@exemplo.com')
  })

  it('não revela que o CPF não tem cadastro', async () => {
    mundo.insider = null
    const { POST } = await import('../insiders/codigo/route')
    const res = await POST(post(URL_CODIGO, { cpf: CPF_VALIDO }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    // Sem `enviado_para`: é o único sinal, e ele some quando não houve envio.
    expect(body.enviado_para).toBeUndefined()
    expect(enviados).toHaveLength(0)
  })

  it('não envia para insider inativo, e responde igual', async () => {
    mundo.insider = { ...(mundo.insider as object), ativo: false }
    const { POST } = await import('../insiders/codigo/route')
    const res = await POST(post(URL_CODIGO, { cpf: CPF_VALIDO }))

    expect(res.status).toBe(200)
    expect(enviados).toHaveLength(0)
  })
})

describe('POST /api/insiders/entrar-codigo', () => {
  const daquiAPouco = () => new Date(Date.now() + 5 * 60_000).toISOString()

  it('recusa requisição de outra origem', async () => {
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '123456' }, false))
    expect(res.status).toBe(403)
  })

  it('recusa código com formato errado sem consultar códigos', async () => {
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '12345' }))
    expect(res.status).toBe(401)
  })

  it('recusa quando não há código vigente', async () => {
    mundo.codigos = []
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '123456' }))
    expect(res.status).toBe(401)
  })

  it('recusa código expirado', async () => {
    const { hashPassword } = await import('@/lib/auth/password')
    mundo.codigos = [
      {
        id: 'c-1',
        codigo_hash: await hashPassword('123456'),
        expira_em: new Date(Date.now() - 1000).toISOString(),
        tentativas: 0,
      },
    ]
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '123456' }))
    expect(res.status).toBe(401)
  })

  it('recusa depois do teto de tentativas, mesmo com o código certo', async () => {
    const { hashPassword } = await import('@/lib/auth/password')
    mundo.codigos = [
      {
        id: 'c-1',
        codigo_hash: await hashPassword('123456'),
        expira_em: daquiAPouco(),
        tentativas: MAX_TENTATIVAS,
      },
    ]
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '123456' }))
    expect(res.status).toBe(401)
  })

  it('conta a tentativa quando o código está errado', async () => {
    const { hashPassword } = await import('@/lib/auth/password')
    mundo.codigos = [
      { id: 'c-1', codigo_hash: await hashPassword('123456'), expira_em: daquiAPouco(), tentativas: 2 },
    ]
    const { POST } = await import('../insiders/entrar-codigo/route')
    const res = await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '999999' }))

    expect(res.status).toBe(401)
    expect(mundo.atualizacoes).toContainEqual({ tentativas: 3 })
  })

  it('mensagem de falha é a mesma para CPF ausente e código errado', async () => {
    const { hashPassword } = await import('@/lib/auth/password')
    mundo.codigos = [
      { id: 'c-1', codigo_hash: await hashPassword('123456'), expira_em: daquiAPouco(), tentativas: 0 },
    ]
    const { POST } = await import('../insiders/entrar-codigo/route')
    const errado = await (await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '999999' }))).json()

    mundo.insider = null
    const semCadastro = await (await POST(post(URL_ENTRAR, { cpf: CPF_VALIDO, codigo: '123456' }))).json()

    expect(errado.error).toBe(semCadastro.error)
  })
})
