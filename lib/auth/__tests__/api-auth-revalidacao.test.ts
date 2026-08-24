/**
 * @jest-environment node
 */
/**
 * `requirePermission` não pode confiar nas permissions gravadas no cookie:
 * elas só são reemitidas no login e ficam válidas por 7 dias, então revogar
 * um módulo no painel precisa valer no request seguinte.
 */
process.env.SESSION_SECRET = 'segredo-de-teste-api-auth'
process.env.SUPABASE_URL = 'https://projeto.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-teste'

import type { NextRequest } from 'next/server'
import type { ModulePermissions, SessionPayload } from '../types'

const usuarioNoBanco: {
  is_active: boolean
  role: string
  permissions: Partial<ModulePermissions> | null
} = { is_active: true, role: 'user', permissions: { crm: true } }

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: usuarioNoBanco, error: null }),
        }),
      }),
    }),
  }),
}))

let sessaoDoCookie: SessionPayload | null = null
jest.mock('../session', () => ({
  ...jest.requireActual('../session'),
  getSessionFromRequest: async () => sessaoDoCookie,
}))

import { requireAuth, requirePermission } from '../api-auth'

const req = {} as NextRequest

function cookieCom(permissions: Partial<ModulePermissions> | null, role = 'user'): SessionPayload {
  return {
    sub: 'user-1',
    email: 'alguem@somma.run',
    full_name: 'Alguém',
    role,
    permissions: permissions as ModulePermissions | null,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
}

describe('requireAuth', () => {
  beforeEach(() => {
    usuarioNoBanco.is_active = true
    usuarioNoBanco.role = 'user'
    usuarioNoBanco.permissions = { crm: true }
  })

  it('devolve 401 sem cookie', async () => {
    sessaoDoCookie = null
    const resultado = await requireAuth(req)
    expect(resultado).toHaveProperty('status', 401)
  })

  it('devolve 403 para usuário desativado no banco', async () => {
    sessaoDoCookie = cookieCom({ crm: true })
    usuarioNoBanco.is_active = false
    const resultado = await requireAuth(req)
    expect(resultado).toHaveProperty('status', 403)
  })

  it('substitui as permissions do cookie pelas do banco', async () => {
    // O cookie ainda diz "tem tarefas"; o banco já revogou.
    sessaoDoCookie = cookieCom({ crm: true, tarefas: true })
    usuarioNoBanco.permissions = { crm: true }

    const resultado = await requireAuth(req)
    expect(resultado).not.toHaveProperty('status')
    const { session } = resultado as { session: SessionPayload }
    expect(session.permissions).toEqual({ crm: true })
  })
})

describe('requirePermission', () => {
  beforeEach(() => {
    usuarioNoBanco.is_active = true
    usuarioNoBanco.role = 'user'
    usuarioNoBanco.permissions = { crm: true }
  })

  it('nega módulo revogado no banco mesmo com o cookie antigo liberando', async () => {
    sessaoDoCookie = cookieCom({ crm: true, tarefas: true })
    const resultado = await requirePermission(req, 'tarefas')
    expect(resultado).toHaveProperty('status', 403)
  })

  it('libera módulo concedido no banco mesmo que o cookie não o tenha', async () => {
    sessaoDoCookie = cookieCom({})
    usuarioNoBanco.permissions = { tarefas: true }
    const resultado = await requirePermission(req, 'tarefas')
    expect(resultado).not.toHaveProperty('status')
  })

  it('nega quando o cookie diz admin e o banco já rebaixou o papel', async () => {
    sessaoDoCookie = cookieCom({}, 'admin')
    usuarioNoBanco.role = 'user'
    usuarioNoBanco.permissions = { crm: true }
    const resultado = await requirePermission(req, 'admin')
    expect(resultado).toHaveProperty('status', 403)
  })
})
