import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Candidatos das vagas (`candidatos_vagas`).
 *
 * A tabela é alimentada pelo formulário de /trabalhe-conosco-vagas no site,
 * que grava no MESMO Supabase deste painel. Aqui só se lê e tria.
 *
 * `curriculo_path` sai na resposta apenas como sinalizador de que existe
 * arquivo — o download passa por /api/vagas/[id]/curriculo, que gera URL
 * assinada de curta duração. O bucket `curriculos` é privado.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'vagas')
  if (auth instanceof NextResponse) return auth

  try {
    const { data, error } = await getAdminClient()
      .from('candidatos_vagas')
      .select('*')
      .order('criado_em', { ascending: false })

    if (error) {
      console.error('[vagas] Erro ao buscar candidatos:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[vagas] Erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
