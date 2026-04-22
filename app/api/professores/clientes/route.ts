import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase admin credentials not configured')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// GET /api/professores/clientes?professor_id=xxx
export async function GET(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(request.url)
    const professorId = searchParams.get('professor_id')

    let query = supabase
      .from('professor_clients')
      .select('*')
      .eq('status', 'active')
      .order('linked_at', { ascending: false })

    if (professorId) {
      query = query.eq('professor_id', professorId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[v0] Error fetching professor clients:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('[v0] Error in GET /api/professores/clientes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

// POST /api/professores/clientes
export async function POST(request: NextRequest) {
  try {
    const supabase = getAdminClient()
    const body = await request.json()

    const {
      professor_id,
      asaas_customer_id,
      customer_name,
      customer_email,
      customer_cpf_cnpj,
      status,
      tag,
      linked_at,
    } = body

    if (!professor_id || !customer_name) {
      return NextResponse.json({ error: 'professor_id e customer_name são obrigatórios' }, { status: 400 })
    }

    // Verificar se já existe um vínculo inativo (reativar em vez de inserir)
    if (asaas_customer_id) {
      const { data: existing } = await supabase
        .from('professor_clients')
        .select('id, status')
        .eq('professor_id', professor_id)
        .eq('asaas_customer_id', asaas_customer_id)
        .single()

      if (existing) {
        if (existing.status === 'active') {
          return NextResponse.json({ error: 'Este cliente já está vinculado a este professor', code: '23505' }, { status: 409 })
        }
        // Reativar vínculo existente
        const { data, error } = await supabase
          .from('professor_clients')
          .update({
            status: 'active',
            customer_name,
            customer_email: customer_email || '',
            customer_cpf_cnpj: customer_cpf_cnpj || null,
            tag: tag || 'alunoprofessor',
            linked_at: linked_at || new Date().toISOString(),
            unlinked_at: null,
          })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) {
          console.error('[v0] Error reactivating professor client:', error)
          return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
        }
        return NextResponse.json({ data })
      }
    }

    const { data, error } = await supabase
      .from('professor_clients')
      .insert([{
        professor_id,
        asaas_customer_id: asaas_customer_id || null,
        customer_name,
        customer_email: customer_email || '',
        customer_cpf_cnpj: customer_cpf_cnpj || null,
        status: status || 'active',
        tag: tag || 'alunoprofessor',
        linked_at: linked_at || new Date().toISOString(),
      }])
      .select()
      .single()

    if (error) {
      console.error('[v0] Error inserting professor client:', error)
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[v0] Error in POST /api/professores/clientes:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
