import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromRequest } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS, toInsiderPublic } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'

export async function GET(req: NextRequest) {
  try {
    // A identidade vem do cookie assinado. Nunca de parâmetro do cliente.
    const sessao = await getInsiderFromRequest(req)
    if (!sessao) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = getAdminClient()

    const { data: row, error } = await supabase
      .from('dados_insiders')
      .select(`${INSIDER_PUBLIC_COLUMNS}, ${BENEFICIO_COLUNAS}`)
      .eq('id', sessao.sub)
      .maybeSingle()

    if (error) {
      console.error('[insiders/eu] select error:', error)
      return NextResponse.json({ error: 'Erro ao carregar seus dados.' }, { status: 500 })
    }

    if (!row) {
      // Cadastro removido depois do login: a sessão não vale mais nada.
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const linha = row as Record<string, unknown>

    const { data: credencial } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', sessao.sub)
      .maybeSingle()

    return NextResponse.json({
      insider: toInsiderPublic(linha, Boolean(credencial)),
      beneficios: montarBeneficios(linha),
    })
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
