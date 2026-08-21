import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { TABELA_TOKENS, VALIDADE_HORAS, codigoValido } from '@/lib/pix-automatico/tokens'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Ações sobre UM código de liberação do Pix Automático: prorrogar a validade
// ou excluir. O site (sommaclub.com.br) só lê e consome a tabela; remover ou
// estender um código aqui muda na hora o que o checkout aceita.

const CAMPOS = 'codigo, criado_em, expira_em, usado_em, usado_por_nome, observacao, criado_por'

/**
 * Prorroga o código: a validade volta a contar VALIDADE_HORAS a partir de
 * agora. Serve tanto para estender um código ainda disponível quanto para
 * reativar um expirado. Código já usado não volta: o `usado_em` entra no
 * filtro do próprio UPDATE, então nem uma corrida com o checkout consegue
 * reabrir um código consumido.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const auth = await requirePermission(request, 'pixAutomatico')
  if (auth instanceof NextResponse) return auth

  const { codigo } = await params
  if (!codigoValido(codigo)) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const expiraEm = new Date(Date.now() + VALIDADE_HORAS * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from(TABELA_TOKENS)
    .update({ expira_em: expiraEm })
    .eq('codigo', codigo)
    .is('usado_em', null)
    .select(CAMPOS)
    .maybeSingle()

  if (error) {
    console.error('[pix-automatico] Erro ao prorrogar código:', error)
    return NextResponse.json({ error: 'Erro ao prorrogar o código' }, { status: 500 })
  }

  if (!data) {
    // Não veio linha: ou o código não existe, ou acabou de ser usado.
    const { data: existente, error: erroConsulta } = await supabase
      .from(TABELA_TOKENS)
      .select('usado_em')
      .eq('codigo', codigo)
      .maybeSingle()
    if (erroConsulta) {
      // Sem essa resposta não dá para afirmar que o código não existe.
      console.error('[pix-automatico] Erro ao conferir código não prorrogado:', erroConsulta)
      return NextResponse.json({ error: 'Erro ao prorrogar o código' }, { status: 500 })
    }
    if (existente?.usado_em) {
      return NextResponse.json(
        { error: 'Este código já foi usado e não pode ser prorrogado. Gere um novo.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Código não encontrado' }, { status: 404 })
  }

  console.log('[pix-automatico] Código', codigo, 'prorrogado até', expiraEm, 'por', auth.session.email ?? 'admin')
  return NextResponse.json({ token: data })
}

/**
 * Exclui o código. Vale para qualquer estado — inclusive usado, caso em que o
 * registro de quem usou se perde; a confirmação fica no painel.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const auth = await requirePermission(request, 'pixAutomatico')
  if (auth instanceof NextResponse) return auth

  const { codigo } = await params
  if (!codigoValido(codigo)) {
    return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from(TABELA_TOKENS)
    .delete()
    .eq('codigo', codigo)
    .select('codigo')
    .maybeSingle()

  if (error) {
    console.error('[pix-automatico] Erro ao excluir código:', error)
    return NextResponse.json({ error: 'Erro ao excluir o código' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Código não encontrado' }, { status: 404 })
  }

  console.log('[pix-automatico] Código', codigo, 'excluído por', auth.session.email ?? 'admin')
  return NextResponse.json({ ok: true })
}
