import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { CAMPOS_CUPOM, TABELA_CUPONS, validarEntrada } from '@/lib/cupons/tipos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Ações sobre UM cupom. O checkout do site lê esta mesma tabela a cada
// tentativa de compra, então editar ou excluir aqui muda o preço praticado no
// próximo cliente que digitar o código.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Cupom inválido' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validacao = validarEntrada(body)
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 })

  // `usage_count` fica de fora de propósito: quem conta é o checkout, e
  // reescrever o contador daqui apagaria usos reais.
  const { data, error } = await getAdminClient()
    .from(TABELA_CUPONS)
    .update({ ...validacao.entrada, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(CAMPOS_CUPOM)
    .maybeSingle()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Já existe outro cupom com o código ${validacao.entrada.code}` },
        { status: 409 }
      )
    }
    console.error('[cupons] Erro ao atualizar cupom:', error)
    return NextResponse.json({ error: 'Erro ao salvar o cupom' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 })

  console.log('[cupons] Cupom', validacao.entrada.code, 'editado por', auth.session.email)
  return NextResponse.json({ cupom: data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Cupom inválido' }, { status: 400 })

  const admin = getAdminClient()

  // `coupon_redemptions.coupon_id` referencia o cupom: se houver resgate
  // registrado, o Postgres barra o DELETE. Apagar o histórico de quem usou o
  // cupom junto seria pior, então a saída é desativar.
  const { count, error: erroResgates } = await admin
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', id)

  if (erroResgates) {
    console.error('[cupons] Erro ao checar resgates do cupom:', erroResgates)
    return NextResponse.json({ error: 'Erro ao excluir o cupom' }, { status: 500 })
  }
  if (count && count > 0) {
    return NextResponse.json(
      {
        error: `Cupom já foi usado ${count} ${count === 1 ? 'vez' : 'vezes'} e não pode ser excluído. Desative-o para tirar de circulação.`,
      },
      { status: 409 }
    )
  }

  const { data, error } = await admin
    .from(TABELA_CUPONS)
    .delete()
    .eq('id', id)
    .select('code')
    .maybeSingle()

  if (error) {
    console.error('[cupons] Erro ao excluir cupom:', error)
    return NextResponse.json({ error: 'Erro ao excluir o cupom' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 })

  console.log('[cupons] Cupom', data.code, 'excluído por', auth.session.email)
  return NextResponse.json({ success: true })
}
