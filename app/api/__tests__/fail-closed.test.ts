/**
 * @jest-environment node
 */
/**
 * Rotas que não podem processar nada sem o segredo configurado, e o contrato
 * mínimo do lookup público de insider.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-rotas'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'

import { NextRequest } from 'next/server'

const supabaseMock = {
  insider: { existe: true, temSenha: true },
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (tabela: string) => {
      if (tabela === 'insider_credentials') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: supabaseMock.insider.temSenha ? { insider_id: 'i-1' } : null,
                error: null,
              }),
            }),
          }),
        }
      }
      // dados_insiders
      return {
        select: () => ({
          in: () => ({
            limit: async () => ({
              data: supabaseMock.insider.existe ? [{ id: 'i-1' }] : [],
              error: null,
            }),
          }),
        }),
      }
    },
  }),
}))

function post(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('webhook do Asaas', () => {
  const original = process.env.ASAAS_WEBHOOK_TOKEN

  afterEach(() => {
    process.env.ASAAS_WEBHOOK_TOKEN = original
    jest.resetModules()
  })

  it('recusa quando ASAAS_WEBHOOK_TOKEN não está configurado', async () => {
    delete process.env.ASAAS_WEBHOOK_TOKEN
    const { POST } = await import('../webhooks/asaas/route')
    const res = await POST(post('https://app.local/api/webhooks/asaas', { event: 'PAYMENT_RECEIVED' }))
    expect(res.status).toBe(401)
  })

  it('recusa token divergente', async () => {
    process.env.ASAAS_WEBHOOK_TOKEN = 'token-certo'
    const { POST } = await import('../webhooks/asaas/route')
    const res = await POST(
      post('https://app.local/api/webhooks/asaas', { event: 'PAYMENT_RECEIVED' }, {
        'asaas-access-token': 'token-errado',
      })
    )
    expect(res.status).toBe(401)
  })
})

describe('POST /api/checkout/validate-coupon', () => {
  const original = process.env.CHECKOUT_API_SECRET

  afterEach(() => {
    process.env.CHECKOUT_API_SECRET = original
    jest.resetModules()
  })

  it('recusa quando CHECKOUT_API_SECRET não está configurado', async () => {
    delete process.env.CHECKOUT_API_SECRET
    const { POST } = await import('../checkout/validate-coupon/route')
    const res = await POST(post('https://app.local/api/checkout/validate-coupon', { code: 'X', value: 10 }))
    expect(res.status).toBe(401)
  })

  it('recusa Authorization divergente', async () => {
    process.env.CHECKOUT_API_SECRET = 'secreto'
    const { POST } = await import('../checkout/validate-coupon/route')
    const res = await POST(
      post('https://app.local/api/checkout/validate-coupon', { code: 'X', value: 10 }, {
        authorization: 'Bearer errado',
      })
    )
    expect(res.status).toBe(401)
  })
})

describe('POST /api/insiders/lookup', () => {
  afterEach(() => {
    supabaseMock.insider = { existe: true, temSenha: true }
  })

  it('não devolve nenhum dado pessoal', async () => {
    const { POST } = await import('../insiders/lookup/route')
    // CPF válido pelo dígito verificador.
    const res = await POST(post('https://app.local/api/insiders/lookup', { cpf: '529.982.247-25' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ found: true, tem_senha: true })
    for (const proibido of ['nome', 'email', 'telefone', 'cep', 'logradouro', 'foto_url', 'insider']) {
      expect(body).not.toHaveProperty(proibido)
    }
  })

  it('devolve apenas found:false quando o CPF não existe', async () => {
    supabaseMock.insider = { existe: false, temSenha: false }
    const { POST } = await import('../insiders/lookup/route')
    const res = await POST(post('https://app.local/api/insiders/lookup', { cpf: '529.982.247-25' }))
    expect(await res.json()).toEqual({ found: false })
  })

  it('recusa CPF inválido', async () => {
    const { POST } = await import('../insiders/lookup/route')
    const res = await POST(post('https://app.local/api/insiders/lookup', { cpf: '111.111.111-11' }))
    expect(res.status).toBe(400)
  })
})
