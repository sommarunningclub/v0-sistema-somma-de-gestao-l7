import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EventoUpdate } from '@/lib/types/evento'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdminClient()
    const body: EventoUpdate = await request.json()

    if (body.checkin_abertura && body.checkin_fechamento) {
      if (new Date(body.checkin_abertura) >= new Date(body.checkin_fechamento)) {
        return NextResponse.json(
          { error: 'Abertura do check-in deve ser anterior ao fechamento' },
          { status: 400 }
        )
      }
    }

    const updateObj: Record<string, unknown> = {}
    if (body.titulo !== undefined) updateObj.titulo = body.titulo.trim()
    if (body.descricao !== undefined) updateObj.descricao = body.descricao || null
    if (body.data_evento !== undefined) updateObj.data_evento = body.data_evento
    if (body.horario_inicio !== undefined) updateObj.horario_inicio = body.horario_inicio
    if (body.local !== undefined) updateObj.local = body.local
    if (body.checkin_abertura !== undefined) updateObj.checkin_abertura = body.checkin_abertura || null
    if (body.checkin_fechamento !== undefined) updateObj.checkin_fechamento = body.checkin_fechamento || null
    if (body.checkin_status !== undefined) updateObj.checkin_status = body.checkin_status
    if (body.pelotoes !== undefined) updateObj.pelotoes = body.pelotoes

    const { data, error } = await supabase
      .from('eventos')
      .update(updateObj)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[v0] Error PUT /api/insider/eventos/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update evento' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = getAdminClient()

    const { error } = await supabase
      .from('eventos')
      .delete()
      .eq('id', id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Error DELETE /api/insider/eventos/[id]:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete evento' },
      { status: 500 }
    )
  }
}
