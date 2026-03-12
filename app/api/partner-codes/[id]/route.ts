import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase()
  try {
    const { id } = params
    
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
  { params }: { params: { id: string } }
) {
  const supabase = getSupabase()
  try {
    const { id } = params
    const { ativo } = await request.json()
    
    if (!id) {
      return NextResponse.json(
        { error: 'ID do código é obrigatório' },
        { status: 400 }
      )
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
