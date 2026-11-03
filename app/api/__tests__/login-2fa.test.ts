/**
 * @jest-environment node
 */
/**
 * Login em duas etapas, de ponta a ponta nas rotas (banco simulado).
 *
 *   senha certa      → só cookie de etapa pendente, nenhuma sessão
 *   sem autenticador → setup devolve QR e grava o segredo CIFRADO
 *   código certo     → sessão; código repetido ou errado → recusa
 */
process.env.SESSION_SECRET = 'segredo-de-teste-login-2fa-0123456789'
process.env.MFA_ENCRYPTION_KEY = 'chave-de-teste-login-2fa-0123456789abcdef'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'

import { NextRequest } from 'next/server'
import { hashPassword } from '@/lib/auth/password'
import { base32Decode, codigoNoPasso, passoAtual } from '@/lib/auth/totp'
import { decifrarSegredo } from '@/lib/auth/totp-crypto'
import { MFA_PENDING_COOKIE, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session'

const USER_ID = '11111111-1111-4111-8111-111111111111'

type Totp = { user_id: string; secret_enc: string; enabled_at: string | null; last_used_step: number | null }

const mundo = {
  usuario: null as Record<string, unknown> | null,
  totp: null as Totp | null,
}

// Supabase mínimo: users (leitura) e user_totp (leitura, upsert, update condicional, delete).
function construtor(tabela: string) {
  const filtros: Array<(l: Totp) => boolean> = []
  let op: 'select' | 'update' | 'upsert' | 'delete' = 'select'
  let payload: Record<string, unknown> = {}
  const b: Record<string, unknown> = {}
  const chain = () => b
  b.select = chain
  b.order = chain
  b.not = chain
  b.eq = (col: string, v: unknown) => {
    filtros.push((l) => (l as Record<string, unknown>)[col] === v)
    return b
  }
  b.is = (col: string, v: unknown) => {
    filtros.push((l) => (l as Record<string, unknown>)[col] === v)
    return b
  }
  b.or = (expr: string) => {
    const passo = Number(expr.split('lt.')[1])
    filtros.push((l) => l.last_used_step === null || l.last_used_step < passo)
    return b
  }
  b.update = (p: Record<string, unknown>) => {
    op = 'update'
    payload = p
    return b
  }
  b.upsert = (p: Record<string, unknown>) => {
    op = 'upsert'
    payload = p
    return b
  }
  b.delete = () => {
    op = 'delete'
    return b
  }
  const executar = async () => {
    if (tabela === 'users') return { data: mundo.usuario, error: null }
    const linha = mundo.totp
    const casa = linha !== null && filtros.every((f) => f(linha))
    if (op === 'upsert') {
      mundo.totp = { ...(payload as Totp) }
      return { data: null, error: null }
    }
    if (op === 'update') {
      if (!casa) return { data: [], error: null }
      mundo.totp = { ...linha!, ...(payload as Partial<Totp>) }
      return { data: [{ user_id: linha!.user_id }], error: null }
    }
    if (op === 'delete') {
      if (casa) mundo.totp = null
      return { data: null, error: null }
    }
    return { data: casa ? linha : null, error: null }
  }
  b.single = executar
  b.maybeSingle = executar
  b.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => executar().then(ok, erro)
  return b
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (t: string) => construtor(t) }),
}))

function req(url: string, body: unknown, cookies: Record<string, string> = {}): NextRequest {
  const r = new NextRequest(`https://admin.sommaclub.com.br${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify(body),
  })
  for (const [k, v] of Object.entries(cookies)) r.cookies.set(k, v)
  return r
}

function cookieDe(res: Response, nome: string): string | undefined {
  const linhas = res.headers.getSetCookie?.() ?? []
  const linha = linhas.find((l) => l.startsWith(`${nome}=`))
  return linha ? decodeURIComponent(linha.split(';')[0].slice(nome.length + 1)) : undefined
}

async function codigoAtual(): Promise<string> {
  const segredo = decifrarSegredo(mundo.totp!.secret_enc)
  return codigoNoPasso(base32Decode(segredo), passoAtual())
}

beforeAll(async () => {
  mundo.usuario = {
    id: USER_ID,
    email: 'ana@somma.run',
    full_name: 'Ana',
    role: 'admin',
    is_active: true,
    permissions: null,
    password_hash: await hashPassword('senha-certa-123'),
  }
})

beforeEach(() => {
  mundo.totp = null
  mundo.usuario!.is_active = true
  jest.resetModules()
})

async function rotas() {
  const login = (await import('../auth/login/route')).POST
  const setup = (await import('../auth/mfa/setup/route')).POST
  const verify = (await import('../auth/mfa/verify/route')).POST
  return { login, setup, verify }
}

describe('POST /api/auth/login', () => {
  it('senha certa sem autenticador: pede cadastro e não abre sessão', async () => {
    const { login } = await rotas()
    const res = await login(req('/api/auth/login', { email: 'ana@somma.run', password: 'senha-certa-123' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mfa: 'cadastro' })
    expect(cookieDe(res, MFA_PENDING_COOKIE)).toBeTruthy()
    // Cookie de sessão só aparece apagado (maxAge 0), nunca com valor.
    expect(cookieDe(res, SESSION_COOKIE) ?? '').toBe('')
  })

  it('senha errada: 401 e nenhum cookie pendente', async () => {
    const { login } = await rotas()
    const res = await login(req('/api/auth/login', { email: 'ana@somma.run', password: 'errada' }))
    expect(res.status).toBe(401)
    expect(cookieDe(res, MFA_PENDING_COOKIE)).toBeUndefined()
  })
})

describe('cadastro + código', () => {
  async function loginPendente(login: (r: NextRequest) => Promise<Response>) {
    const res = await login(req('/api/auth/login', { email: 'ana@somma.run', password: 'senha-certa-123' }))
    return { etapa: (await res.json()).mfa as string, pendente: cookieDe(res, MFA_PENDING_COOKIE)! }
  }

  it('fluxo completo: QR, primeiro código ativa e abre sessão; código repetido é recusado', async () => {
    const { login, setup, verify } = await rotas()
    const { pendente } = await loginPendente(login)

    const resSetup = await setup(req('/api/auth/mfa/setup', {}, { [MFA_PENDING_COOKIE]: pendente }))
    expect(resSetup.status).toBe(200)
    const corpo = await resSetup.json()
    expect(corpo.qr).toMatch(/^data:image\/png;base64,/)
    expect(corpo.segredo).toMatch(/^[A-Z2-7 ]+$/)
    // Gravado cifrado, nunca em claro.
    expect(mundo.totp!.secret_enc).not.toContain(corpo.segredo.replace(/\s/g, ''))
    expect(mundo.totp!.enabled_at).toBeNull()

    const codigo = await codigoAtual()
    const resVerify = await verify(req('/api/auth/mfa/verify', { codigo }, { [MFA_PENDING_COOKIE]: pendente }))
    expect(resVerify.status).toBe(200)
    const sessao = cookieDe(resVerify, SESSION_COOKIE)
    expect(sessao).toBeTruthy()
    expect(await verifySessionToken(sessao!)).toMatchObject({ sub: USER_ID, mfa: true })
    expect(mundo.totp!.enabled_at).not.toBeNull()

    // Próximo login: agora pede código, e o mesmo código não vale de novo.
    const segundo = await loginPendente(login)
    expect(segundo.etapa).toBe('codigo')
    const repetido = await verify(req('/api/auth/mfa/verify', { codigo }, { [MFA_PENDING_COOKIE]: segundo.pendente }))
    expect(repetido.status).toBe(401)
    expect(cookieDe(repetido, SESSION_COOKIE)).toBeUndefined()
  })

  it('código errado não abre sessão', async () => {
    const { login, setup, verify } = await rotas()
    const { pendente } = await loginPendente(login)
    await setup(req('/api/auth/mfa/setup', {}, { [MFA_PENDING_COOKIE]: pendente }))

    const certo = await codigoAtual()
    const errado = String((Number(certo) + 1) % 1_000_000).padStart(6, '0')
    const res = await verify(req('/api/auth/mfa/verify', { codigo: errado }, { [MFA_PENDING_COOKIE]: pendente }))
    expect(res.status).toBe(401)
    expect(cookieDe(res, SESSION_COOKIE)).toBeUndefined()
    expect(mundo.totp!.enabled_at).toBeNull()
  })

  it('sem cookie pendente, setup e verify recusam', async () => {
    const { setup, verify } = await rotas()
    expect((await setup(req('/api/auth/mfa/setup', {}))).status).toBe(401)
    expect((await verify(req('/api/auth/mfa/verify', { codigo: '123456' }))).status).toBe(401)
  })

  it('setup recusa quem já tem autenticador confirmado', async () => {
    const { login, setup, verify } = await rotas()
    const primeiro = await loginPendente(login)
    await setup(req('/api/auth/mfa/setup', {}, { [MFA_PENDING_COOKIE]: primeiro.pendente }))
    await verify(req('/api/auth/mfa/verify', { codigo: await codigoAtual() }, { [MFA_PENDING_COOKIE]: primeiro.pendente }))

    // Um token pendente velho de 'cadastro' não serve para trocar o autenticador.
    const res = await setup(req('/api/auth/mfa/setup', {}, { [MFA_PENDING_COOKIE]: primeiro.pendente }))
    expect(res.status).toBe(409)
  })

  it('conta desativada entre a senha e o código não ganha sessão', async () => {
    const { login, setup, verify } = await rotas()
    const { pendente } = await loginPendente(login)
    await setup(req('/api/auth/mfa/setup', {}, { [MFA_PENDING_COOKIE]: pendente }))
    mundo.usuario!.is_active = false
    const res = await verify(req('/api/auth/mfa/verify', { codigo: await codigoAtual() }, { [MFA_PENDING_COOKIE]: pendente }))
    expect(res.status).toBe(403)
    expect(cookieDe(res, SESSION_COOKIE)).toBeUndefined()
  })
})
