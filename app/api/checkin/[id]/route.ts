import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()

    const { error } = await supabase
      .from('checkins')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[v0] Supabase error deleting checkin:', error)
      return NextResponse.json(
        { error: `Erro ao deletar: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id })
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

    const supabase = createClient()

    const { data, error } = await supabase
      .from('checkins')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating check-in fields:', error)
      return NextResponse.json({ error: `Erro ao atualizar: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
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

    const supabase = createClient()

    // Update the check-in validation status
    const { data, error } = await supabase
      .from('checkins')
      .update({
        validacao_do_checkin: validacao_do_checkin,
        validated_at: validacao_do_checkin ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating check-in validation:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    console.log('[v0] Check-in validation updated:', id, 'Status:', validacao_do_checkin)

    return NextResponse.json({
      success: true,
      message: 'Validação atualizada com sucesso',
      data: data,
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
