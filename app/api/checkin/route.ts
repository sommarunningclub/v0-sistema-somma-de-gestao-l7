import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  email?: string
  cpf: string
  pelotao?: string
  sexo?: string
  data: string
  event?: string
  event_date?: string
  event_time?: string
  validated?: boolean
  validated_at?: string | null
  qr_code?: string
}

/**
 * GET /api/checkin
 * Returns check-in records from Supabase table "checkins" for today onwards
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient()

    console.log('[v0] Fetching check-ins from 2026-03-11 onwards')

    // Return all check-ins from 11/03/2026 onwards
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .gte('data_hora_checkin', '2026-03-11T03:00:00.000Z')
      .order('data_hora_checkin', { ascending: false })

    if (error) {
      console.error('[v0] Supabase error fetching checkins:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    console.log('[v0] Fetched check-in data from Supabase, count:', data?.length || 0)

    // Transform Supabase data to CheckInData format
    const transformedData: CheckInData[] = (data || []).map(record => ({
      id: record.id,
      nome: record.nome_completo || '',
      telefone: record.telefone || '',
      email: record.email || '',
      cpf: record.cpf || '',
      pelotao: record.pelotao || '',
      sexo: record.sexo || '',
      data: record.data_hora_checkin ? new Date(record.data_hora_checkin).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      event: record.nome_do_evento || '',
      event_date: record.data_do_evento ? new Date(record.data_do_evento).toLocaleDateString('pt-BR') : '',
      event_time: record.data_hora_checkin ? new Date(record.data_hora_checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
      validated: record.validacao_do_checkin || false,
      validated_at: record.validacao_do_checkin ? record.data_hora_checkin : null,
      qr_code: record.qr_code || '',
    }))

    return NextResponse.json({
      data: transformedData,
      count: transformedData.length,
      timestamp: new Date().toISOString(),
      source: 'supabase'
    })
  } catch (error) {
    console.error('[v0] Error in GET /api/checkin:', error)
    console.error('[v0] Error stack:', error instanceof Error ? error.stack : 'No stack trace')

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch check-in data',
        data: [],
        count: 0,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
