import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  email?: string
  cpf: string
  pelotao?: string
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
    const supabase = createClient()

    // Get today's date at 00:00:00
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    console.log('[v0] Fetching check-in data from Supabase for today onwards:', todayISO)

    // Query Supabase for check-ins from today onwards
    // Use data_hora_checkin (timestamp) to filter by today's records
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .gte('data_hora_checkin', todayISO)
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
