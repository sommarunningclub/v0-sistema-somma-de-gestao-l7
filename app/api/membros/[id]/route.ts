import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickMemberFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'

// Mesmo motivo da rota pai: `cadastro_site` tem RLS e o browser só tem a role
// `anon`. Com a anon key o UPDATE/DELETE não dá erro — ele simplesmente não
// afeta nenhuma linha, e o registro "volta" ao recarregar a página.

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) ? id : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('cadastro_site')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[membros] Erro ao buscar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[membros] Erro inesperado no GET [id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const fields = pickMemberFields(await request.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    // .select() devolve as linhas afetadas — sem isso um id inexistente
    // retornaria sucesso sem ter alterado nada.
    const { data, error } = await getAdminClient()
      .from('cadastro_site')
      .update(fields)
      .eq('id', id)
      .select('id, nome_completo, email, cpf, whatsapp, data_nascimento')

    if (error) {
      console.error('[membros] Erro ao atualizar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Membro não encontrado (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: data[0] })
  } catch (err) {
    console.error('[membros] Erro inesperado no PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('cadastro_site')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[membros] Erro ao deletar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Membro não encontrado (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[membros] Erro inesperado no DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
