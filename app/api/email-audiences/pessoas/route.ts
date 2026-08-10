import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { applyMemberSearch } from '@/lib/api/member-search'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Teto de sugestões — é um autocomplete, não uma listagem. */
const LIMIT = 10

/**
 * Busca pessoas para o envio individual.
 *
 * Rota própria em vez de reusar `/api/membros` porque aquela exige a permissão
 * `membros`, que dá acesso a CPF, telefone e edição de cadastro. Quem opera
 * e-mail marketing precisa só de nome e e-mail — e é só isso que sai daqui.
 */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const term = (req.nextUrl.searchParams.get('q') ?? '').trim()
  if (term.length < 2) return NextResponse.json({ data: [] })

  try {
    const supabase = getAdminClient()
    let query = supabase
      .from('cadastro_site')
      .select('nome_completo, email')
      .not('email', 'is', null)
      .limit(LIMIT)

    query = applyMemberSearch(query, term)

    const { data, error } = await query
    if (error) {
      console.error('[email-audiences/pessoas] GET error:', error)
      return NextResponse.json({ error: 'Erro ao buscar pessoas' }, { status: 500 })
    }

    return NextResponse.json({
      data: (data ?? []).map((r) => ({ nome: r.nome_completo ?? null, email: r.email })),
    })
  } catch (err) {
    console.error('[email-audiences/pessoas] GET exception:', err)
    return NextResponse.json({ error: 'Erro ao buscar pessoas' }, { status: 500 })
  }
}
