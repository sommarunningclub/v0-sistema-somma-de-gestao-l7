import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickChargeFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) ? id : null
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
    const fields = pickChargeFields(await request.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from('cobrancas_membros')
      .update(fields)
      .eq('id', id)
      .select()

    if (error) {
      console.error('[cobrancas] Erro ao atualizar cobrança:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Cobrança não encontrada (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: data[0] })
  } catch (err) {
    console.error('[cobrancas] Erro inesperado no PATCH:', err)
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
      .from('cobrancas_membros')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[cobrancas] Erro ao deletar cobrança:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Cobrança não encontrada (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[cobrancas] Erro inesperado no DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
