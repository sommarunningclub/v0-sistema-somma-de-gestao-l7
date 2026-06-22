import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Cliente admin (service role) — ignora o RLS da tabela `checkins`.
// O painel admin é uma operação privilegiada de servidor e precisa de
// poder total sobre os dados (deletar, editar, validar). Usar a anon key
// faz o RLS esconder todas as linhas: o delete/update vira um no-op
// silencioso (retorna 200 sem afetar nada) e o registro "volta" ao recarregar.
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = getAdminClient()

    // .select() retorna as linhas removidas — assim detectamos quando nada foi
    // deletado (ex.: id inexistente) em vez de retornar um sucesso falso.
    const { data, error } = await supabase
      .from('checkins')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[v0] Supabase error deleting checkin:', error)
      return NextResponse.json(
        { error: `Erro ao deletar: ${error.message}` },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Check-in não encontrado (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id, deleted: data.length })
  } catch (error) {
    console.error('[v0] Error in DELETE /api/checkin/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/checkin/[id]
 * Updates editable fields of a check-in record
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { nome_completo, telefone, email, cpf, pelotao, sexo } = body

    const updateData: Record<string, string> = {}
    if (nome_completo !== undefined) updateData.nome_completo = nome_completo
    if (telefone !== undefined) updateData.telefone = telefone
    if (email !== undefined) updateData.email = email
    if (cpf !== undefined) updateData.cpf = cpf
    if (pelotao !== undefined) updateData.pelotao = pelotao
    if (sexo !== undefined) updateData.sexo = sexo

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('checkins')
      .update(updateData)
      .eq('id', id)
      .select()

    if (error) {
      console.error('[v0] Error updating check-in fields:', error)
      return NextResponse.json({ error: `Erro ao atualizar: ${error.message}` }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Check-in não encontrado (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: data[0] })
  } catch (error) {
    console.error('[v0] Error in PUT /api/checkin/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/checkin/[id]
 * Updates validation status of a check-in record
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const { validacao_do_checkin } = body

    if (validacao_do_checkin === undefined) {
      return NextResponse.json(
        { error: 'Campo validacao_do_checkin é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()

    // Update the check-in validation status
    const { data, error } = await supabase
      .from('checkins')
      .update({
        validacao_do_checkin: validacao_do_checkin,
        validated_at: validacao_do_checkin ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()

    if (error) {
      console.error('[v0] Error updating check-in validation:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Check-in não encontrado (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    console.log('[v0] Check-in validation updated:', id, 'Status:', validacao_do_checkin)

    return NextResponse.json({
      success: true,
      message: 'Validação atualizada com sucesso',
      data: data[0],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Error in PATCH /api/checkin/[id]:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao atualizar validação',
      },
      { status: 500 }
    )
  }
}
