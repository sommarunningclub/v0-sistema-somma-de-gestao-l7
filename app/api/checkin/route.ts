import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sincronizarInscritosLp, type ResultadoSincronizacao } from '@/lib/checkin/espelho-lp'

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

    const eventoId = request.nextUrl.searchParams.get('evento_id')
    console.log('[v0] Fetching check-ins', eventoId ? `for evento ${eventoId}` : '(all)')

    // Quem se inscreveu pela LP do site entra em `evento_participantes`; esta
    // lista lê `checkins`. Antes de listar, traz quem ainda falta, para a
    // lista, os totais e o CSV baterem com o que a seção Eventos mostra.
    let sincronizacao: ResultadoSincronizacao | null = null
    if (eventoId) {
      sincronizacao = await sincronizarInscritosLp(supabase, eventoId)
      if (sincronizacao.inseridos > 0) {
        console.log('[v0] Inscritos da LP trazidos para checkins:', sincronizacao.inseridos)
      }
    }

    let query = supabase
      .from('checkins')
      .select('*')
      .order('data_hora_checkin', { ascending: false })

    if (eventoId) {
      query = query.eq('evento_id', eventoId)
    }

    const { data, error } = await query

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
      // Quantos vieram da LP nesta carga e quantos ainda faltam (-1 = a sincronização falhou).
      espelhados: sincronizacao?.inseridos ?? 0,
      lp_fora: sincronizacao?.restantes ?? 0,
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
