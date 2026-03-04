import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  cpf: string
  data: string
  sexo?: string
  pelotao?: string
  nome_do_evento?: string
  validated?: boolean
  validated_at?: string | null
}

/**
 * GET /api/checkin
 * Returns all check-in records from Supabase table "checkins"
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    console.log('[v0] Fetching all check-in data from Supabase')

    // Query Supabase for all check-ins
    const { data, error } = await supabase
      .from('checkins')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v0] Supabase error fetching checkins:', error)
      throw new Error(`Supabase error: ${error.message}`)
    }

    console.log('[v0] Fetched all check-in data from Supabase, count:', data?.length || 0)

    // Transform Supabase data to CheckInData format
    // Supabase schema: nome_completo, cpf, telefone, data_hora_checkin, data_do_evento, 
    // validacao_do_checkin, nome_do_evento, sexo, pelotao, email
    const transformedData: CheckInData[] = (data || []).map(record => ({
      id: record.id,
      nome: record.nome_completo || '',
      cpf: record.cpf || '',
      telefone: record.telefone || '',
      data: record.data_hora_checkin 
        ? new Date(record.data_hora_checkin).toLocaleDateString('pt-BR')
        : (record.data_do_evento || ''),
      sexo: record.sexo || '',
      pelotao: record.pelotao || '',
      nome_do_evento: record.nome_do_evento || '',
      validated: record.validacao_do_checkin || false,
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
