import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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
