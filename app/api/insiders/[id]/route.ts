import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickInsiderFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'

/**
 * Atualiza um insider.
 *
 * Usa a MESMA whitelist do POST (`pickInsiderFields`): o corpo da requisição
 * nunca chega cru ao banco, então um cliente não consegue escrever em colunas
 * que não são de cadastro. Nome e CPF são obrigatórios aqui como são na
 * criação — permitir esvaziá-los pela edição deixaria o registro inconsistente
 * e invisível na busca.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  try {
    const fields = pickInsiderFields(await request.json())

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }
    if ('nome' in fields && !String(fields.nome ?? '').trim()) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if ('cpf' in fields && !String(fields.cpf ?? '').trim()) {
      return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .update(fields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[insiders] Erro ao atualizar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Insider não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[insiders] Erro inesperado no PATCH:', err)
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
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[insiders] Erro ao deletar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Insider não encontrado (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[insiders] Erro inesperado no DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
