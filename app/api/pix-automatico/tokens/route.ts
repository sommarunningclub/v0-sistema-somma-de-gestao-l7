import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { TABELA_TOKENS, VALIDADE_HORAS, gerarCodigo } from '@/lib/pix-automatico/tokens'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Códigos de liberação do Pix Automático no checkout do site. Quem consome é
// o sommaclub.com.br; aqui só geramos e acompanhamos.

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'pixAutomatico')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from(TABELA_TOKENS)
    .select('codigo, criado_em, expira_em, usado_em, usado_por_nome, observacao, criado_por')
    .order('criado_em', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[pix-automatico] Erro ao listar códigos:', error)
    return NextResponse.json({ error: 'Erro ao listar códigos' }, { status: 500 })
  }

  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'pixAutomatico')
  if (auth instanceof NextResponse) return auth

  let observacao: string | null = null
  try {
    const body = await request.json()
    if (typeof body?.observacao === 'string') observacao = body.observacao.slice(0, 200) || null
  } catch {
    // corpo vazio é aceito: gera código sem observação
  }

  const supabase = getAdminClient()
  const expiraEm = new Date(Date.now() + VALIDADE_HORAS * 60 * 60 * 1000).toISOString()
  const criadoPor = auth.session.email ?? 'admin'

  // A coluna `codigo` é UNIQUE: em colisão (improvável), tenta de novo em vez
  // de estourar erro para quem está no atendimento.
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const codigo = gerarCodigo()
    const { data, error } = await supabase
      .from(TABELA_TOKENS)
      .insert({ codigo, expira_em: expiraEm, criado_por: criadoPor, observacao })
      .select('codigo, criado_em, expira_em, usado_em, usado_por_nome, observacao, criado_por')
      .single()

    if (!error && data) {
      console.log('[pix-automatico] Código gerado por', criadoPor)
      return NextResponse.json({ token: data })
    }
    if (error && error.code !== '23505') {
      console.error('[pix-automatico] Erro ao gerar código:', error)
      return NextResponse.json({ error: 'Erro ao gerar código' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Não foi possível gerar um código único' }, { status: 500 })
}
