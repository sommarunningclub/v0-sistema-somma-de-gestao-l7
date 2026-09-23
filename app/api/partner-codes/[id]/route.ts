import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { TABELA_VINCULOS, normalizarEventoIds } from '@/lib/parceiros/vinculos'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const { id } = await params
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID do código é obrigatório' },
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('codigo_parceiro')
      .delete()
      .eq('id', id)
      .select()
    
    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Código não encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      data: data[0],
      message: 'Código deletado com sucesso'
    })
  } catch (error) {
    console.error('[v0] Error deleting partner code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete partner code' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const { id } = await params
    const body = await request.json()
    const { ativo } = body

    if (!id) {
      return NextResponse.json(
        { error: 'ID do código é obrigatório' },
        { status: 400 }
      )
    }

    // `evento_ids` chega como a lista completa do que o código deve ter — a
    // tela manda o estado final das caixas marcadas, não um diff. Ausente
    // significa "não mexi nos vínculos", e é o que permite o botão de
    // ativar/desativar continuar mandando só `ativo`.
    if (Array.isArray(body?.evento_ids)) {
      const eventoIds = normalizarEventoIds(body.evento_ids)
      const supabaseVinculos = getAdminClient()

      const { error: erroLimpeza } = await supabaseVinculos
        .from(TABELA_VINCULOS)
        .delete()
        .eq('codigo_id', id)
        // Apaga só o que saiu da seleção: sem isto, regravar a mesma lista
        // zeraria e recriaria tudo, trocando as datas de criação do vínculo.
        .not('evento_id', 'in', `(${eventoIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)

      if (erroLimpeza) {
        console.error('[partner-codes] Erro ao remover vínculos:', erroLimpeza)
        return NextResponse.json({ error: 'Erro ao atualizar os eventos do código' }, { status: 500 })
      }

      if (eventoIds.length > 0) {
        const { error: erroVinculo } = await supabaseVinculos
          .from(TABELA_VINCULOS)
          .upsert(
            eventoIds.map((evento_id) => ({
              codigo_id: id,
              evento_id,
              created_by: auth.session.email ?? null,
            })),
            { onConflict: 'codigo_id,evento_id', ignoreDuplicates: true }
          )
        if (erroVinculo) {
          console.error('[partner-codes] Erro ao vincular eventos:', erroVinculo)
          return NextResponse.json({ error: 'Erro ao atualizar os eventos do código' }, { status: 500 })
        }
      }

      if (typeof ativo !== 'boolean') {
        return NextResponse.json({ data: { id }, message: 'Eventos atualizados' })
      }
    }

    if (typeof ativo !== 'boolean') {
      return NextResponse.json(
        { error: 'Status ativo deve ser um booleano' },
        { status: 400 }
      )
    }
    
    const { data, error } = await supabase
      .from('codigo_parceiro')
      .update({ 
        ativo,
        last_access: new Date().toISOString()
      })
      .eq('id', id)
      .select()
    
    if (error) throw error

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Código não encontrado' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ 
      data: data[0],
      message: 'Código atualizado com sucesso'
    })
  } catch (error) {
    console.error('[v0] Error updating partner code:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update partner code' },
      { status: 500 }
    )
  }
}
