import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET() {
  try {
    const supabase = getAdminClient()
    const today = new Date().toISOString().split('T')[0]

    // Next upcoming event or currently open event (exclude encerrado)
    const { data: upcoming, error: upErr } = await supabase
      .from('eventos')
      .select('id, titulo, data_evento, horario_inicio, local, checkin_status, pelotoes, descricao')
      .or(`data_evento.gt.${today},checkin_status.eq.aberto,checkin_status.eq.bloqueado`)
      .neq('checkin_status', 'encerrado')
      .order('data_evento', { ascending: true })
      .limit(1)
      .single()

    if (upErr && upErr.code !== 'PGRST116') {
      console.error('[v0] Error fetching upcoming evento:', upErr)
    }

    // Recent history (past 30 days, only encerrado)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const { data: historico, error: histErr } = await supabase
      .from('eventos')
      .select('id, titulo, data_evento, local, checkin_status')
      .eq('checkin_status', 'encerrado')
      .gte('data_evento', thirtyDaysAgo)
      .neq('id', upcoming?.id || '00000000-0000-0000-0000-000000000000')
      .order('data_evento', { ascending: false })
      .limit(10)

    if (histErr) {
      console.error('[v0] Error fetching historico:', histErr)
    }

    return NextResponse.json({
      proximo_evento: upcoming || null,
      historico: historico || [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/eventos/ativos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch eventos', proximo_evento: null, historico: [] },
      { status: 500 }
    )
  }
}
