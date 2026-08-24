import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requireAuth } from '@/lib/auth/api-auth'

/*
 * Tags atravessam vários módulos (CRM, membros, cobranças, professores), então
 * a exigência aqui é sessão válida — não um módulo específico. O hook do
 * browser falava direto com a tabela usando a anon key, o que dependia de RLS
 * aberta; ver sql/021-harden-legacy-rls.sql, que fechou entity_tags e
 * tag_definitions para service_role.
 */

const ENTITY_TYPES = new Set([
  'asaas_customer',
  'lista_espera',
  'cobranca',
  'membro',
  'professor_client',
])

function normalizeTag(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/^#/, '') : ''
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  const busca = searchParams.get('tag')

  const supabase = getAdminClient()
  let query = supabase.from('entity_tags').select('*')

  if (busca) {
    query = query.ilike('tag', `%${busca}%`)
  } else {
    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entity_type e entity_id são obrigatórios' },
        { status: 400 }
      )
    }
    query = query
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: true })
  }

  const { data, error } = await query
  if (error) {
    console.error('[entity-tags] GET error:', error)
    return NextResponse.json({ error: 'Erro ao buscar tags' }, { status: 500 })
  }

  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const entityType = String(body.entity_type || '')
    const entityId = String(body.entity_id || '')
    const tag = normalizeTag(body.tag)

    if (!ENTITY_TYPES.has(entityType) || !entityId || !tag) {
      return NextResponse.json({ error: 'Dados da tag inválidos' }, { status: 400 })
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('entity_tags')
      .insert({ entity_type: entityType, entity_id: entityId, tag })
      .select()
      .single()

    if (error) {
      console.error('[entity-tags] POST error:', error)
      return NextResponse.json({ error: 'Erro ao criar tag' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[entity-tags] POST exception:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { error } = await supabase.from('entity_tags').delete().eq('id', id)

  if (error) {
    console.error('[entity-tags] DELETE error:', error)
    return NextResponse.json({ error: 'Erro ao remover tag' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
