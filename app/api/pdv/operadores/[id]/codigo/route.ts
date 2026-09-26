import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { OperadorNaoEncontrado, regenerarCodigo } from '@/lib/pdv/operadores-server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/pdv/operadores/[id]/codigo — novo código de acesso.
 *
 * O anterior deixa de valer no mesmo instante: é a senha do usuário no Auth
 * que muda. Quem perdeu o código não recupera o antigo, recebe outro.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Operador inválido' }, { status: 400 })

  try {
    const { operador, codigo } = await regenerarCodigo(id)
    console.log('[pdv/operadores] Novo código para', id, 'gerado por', auth.session.email)
    return NextResponse.json({ operador, codigo })
  } catch (err) {
    if (err instanceof OperadorNaoEncontrado) {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }
    console.error('[pdv/operadores] Erro ao gerar novo código:', err)
    return NextResponse.json({ error: 'Erro ao gerar o novo código' }, { status: 500 })
  }
}
