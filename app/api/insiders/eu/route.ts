import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/auth/api-auth'
import { getInsiderFromRequest } from '@/lib/auth/insider-session'
import { INSIDER_PUBLIC_COLUMNS, toInsiderPublic } from '@/lib/insider/insider-mapper'
import { montarBeneficios, BENEFICIO_COLUNAS } from '@/lib/insider/beneficios'

export const dynamic = 'force-dynamic'

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

    const { data: credencial, error: credError } = await supabase
      .from('insider_credentials')
      .select('insider_id')
      .eq('insider_id', sessao.sub)
      .maybeSingle()

    // Falha fechado: um erro real de consulta nunca pode virar "sem senha" —
    // isso destravaria o campo senha_atual escondido e o usuário levaria um
    // 401 sem conseguir corrigir.
    let temSenha: boolean
    if (credError) {
      console.error('[insiders/eu] credential error:', credError)
      temSenha = true
    } else {
      temSenha = Boolean(credencial)
    }

    return NextResponse.json(
      {
        insider: toInsiderPublic(linha, temSenha),
        beneficios: montarBeneficios(linha),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      }
    )
  } catch (err) {
    console.error('[insiders/eu] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
