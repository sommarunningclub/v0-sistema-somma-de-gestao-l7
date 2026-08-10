import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { MEMBROS_PAGE_SIZE, pickMemberFields } from '@/lib/api/writable-fields'
import { applyMemberSearch as applySearch } from '@/lib/api/member-search'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// A tabela `cadastro_site` tem RLS ligada e nenhuma policy para a role `anon`.
// O admin não usa Supabase Auth (a sessão é um JWT próprio em cookie), então o
// cliente do browser é sempre `anon` e enxerga zero linhas — sem erro, apenas
// uma lista vazia. Por isso a leitura acontece aqui, no servidor, com service
// role, protegida pela permissão de módulo `membros`.

const LIST_COLUMNS = 'id, nome_completo, email, cpf, whatsapp, data_nascimento'

// A lógica de busca (acento-insensível via `imatch`, AND entre termos, e busca
// por dígitos em CPF/telefone) mora em `@/lib/api/member-search` — é reusada
// por `/api/email-audiences/pessoas`, que atende quem só tem a permissão
// `email`. Ver os comentários lá para o porquê de cada decisão.

// GET /api/membros?page=0&q=termo        -> { data }
// GET /api/membros?countOnly=1&q=termo   -> { count }
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const params = request.nextUrl.searchParams
    const term = (params.get('q') || '').trim()
    const supabase = getAdminClient()

    if (params.get('countOnly') === '1') {
      let query = supabase.from('cadastro_site').select('*', { count: 'exact', head: true })
      if (term) query = applySearch(query, term)

      const { count, error } = await query
      if (error) {
        console.error('[membros] Erro ao contar membros:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ count: count || 0 })
    }

    const page = Math.max(0, Number.parseInt(params.get('page') || '0', 10) || 0)
    const start = page * MEMBROS_PAGE_SIZE
    const end = start + MEMBROS_PAGE_SIZE - 1

    let query = supabase.from('cadastro_site').select(LIST_COLUMNS)
    if (term) query = applySearch(query, term)

    const { data, error } = await query.order('id', { ascending: false }).range(start, end)

    if (error) {
      console.error('[membros] Erro ao buscar membros:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[membros] Erro inesperado no GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

// POST /api/membros -> cria um membro
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const fields = pickMemberFields(await request.json())

    if (!fields.nome_completo || !fields.email) {
      return NextResponse.json(
        { error: 'nome_completo e email são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('cadastro_site')
      .insert([fields])
      .select(LIST_COLUMNS)
      .single()

    if (error) {
      console.error('[membros] Erro ao criar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[membros] Erro inesperado no POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
