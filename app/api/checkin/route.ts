import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CheckInData {
  nome?: string
  telefone?: string
  cpf: string
  data: string
  event?: string
  event_date?: string
  event_time?: string
  validated?: boolean
  validated_at?: string | null
  id?: string
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
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .gte('created_at', todayISO)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Supabase error fetching checkins:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    console.log('[v0] Fetched check-in data from Supabase, count:', data?.length || 0)

    // Transform Supabase data to CheckInData format
    const transformedData: CheckInData[] = (data || []).map(record => ({
      id: record.id,
      cpf: record.cpf || '',
      data: record.event_date || new Date(record.created_at).toLocaleDateString('pt-BR'),
      event: record.event || '',
      event_date: record.event_date || '',
      event_time: record.event_time || '',
      validated: record.validated || false,
      validated_at: record.validated_at || null,
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
