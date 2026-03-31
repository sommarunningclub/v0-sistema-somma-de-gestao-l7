import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { EventoCreate } from '@/lib/types/evento'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('eventos')
      .select('*')
      .order('data_evento', { ascending: false })

    if (error) throw new Error(error.message)

    // Get check-in counts per event (one query per event to avoid Supabase 1000-row limit)
    const countsMap: Record<string, number> = {}

    if (data && data.length > 0) {
      const countPromises = data.map(async (e) => {
        const { count } = await supabase
          .from('checkins')
          .select('*', { count: 'exact', head: true })
          .eq('evento_id', e.id)
        return { id: e.id, count: count || 0 }
      })

      const results = await Promise.all(countPromises)
      for (const r of results) {
        countsMap[r.id] = r.count
      }
    }

    const enriched = (data || []).map(e => ({
      ...e,
      checkin_count: countsMap[e.id] || 0,
    }))

    return NextResponse.json({ data: enriched })
  } catch (error) {
    console.error('[v0] Error GET /api/insider/eventos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eventos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const body: EventoCreate = await request.json()

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'Título é obrigatório' }, { status: 400 })
    }
    if (!body.data_evento) {
      return NextResponse.json({ error: 'Data do evento é obrigatória' }, { status: 400 })
    }

    if (body.checkin_abertura && body.checkin_fechamento) {
      if (new Date(body.checkin_abertura) >= new Date(body.checkin_fechamento)) {
        return NextResponse.json(
          { error: 'Abertura do check-in deve ser anterior ao fechamento' },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('eventos')
      .insert({
        titulo: body.titulo.trim(),
        descricao: body.descricao || null,
        data_evento: body.data_evento,
        horario_inicio: body.horario_inicio || '07:00',
        local: body.local || 'Parque da Cidade — Brasília, DF',
        local_url: body.local_url || null,
        tipo: body.tipo || 'corrida',
        checkin_abertura: body.checkin_abertura || null,
        checkin_fechamento: body.checkin_fechamento || null,
        checkin_status: body.checkin_status || 'bloqueado',
        pelotoes: body.tipo === 'personalizado' ? [] : (body.pelotoes || ['4km', '6km', '8km']),
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    console.error('[v0] Error POST /api/insider/eventos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create evento' },
      { status: 500 }
    )
  }
}
