import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  OperadorNaoEncontrado,
  definirAtivo,
  removerOperador,
} from '@/lib/pdv/operadores-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Ações sobre UM operador. Desativar vale na próxima requisição que a pessoa
// fizer no PDV (o papel some de admin_roles); remover apaga o usuário do Auth.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Operador inválido' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const ativo = (body as { ativo?: unknown } | null)?.ativo
  if (typeof ativo !== 'boolean') {
    return NextResponse.json({ error: 'Informe se o operador fica ativo' }, { status: 400 })
  }

  try {
    const operador = await definirAtivo(id, ativo)
    console.log(
      '[pdv/operadores] Operador',
      id,
      ativo ? 'reativado' : 'desativado',
      'por',
      auth.session.email
    )
    return NextResponse.json({ operador })
  } catch (err) {
    if (err instanceof OperadorNaoEncontrado) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[pdv/operadores] Erro ao alterar status:', err)
    return NextResponse.json({ error: 'Erro ao alterar o operador' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Operador inválido' }, { status: 400 })

  try {
    await removerOperador(id)
    console.log('[pdv/operadores] Operador', id, 'removido por', auth.session.email)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof OperadorNaoEncontrado) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[pdv/operadores] Erro ao remover:', err)
    return NextResponse.json({ error: 'Erro ao remover o operador' }, { status: 500 })
  }
}
