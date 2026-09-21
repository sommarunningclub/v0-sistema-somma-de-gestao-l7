import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { CAMPOS_USO, TABELA_USOS } from '@/lib/cupons/usos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Quem usou um cupom. Só leitura: quem grava é o checkout do site, na hora em
// que a cobrança nasce no Asaas (função `register_coupon_redemption`).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Cupom inválido' }, { status: 400 })

  const { data, error } = await getAdminClient()
    .from(TABELA_USOS)
    .select(CAMPOS_USO)
    .eq('coupon_id', id)
    .order('redeemed_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[cupons] Erro ao listar usos do cupom:', error)
    return NextResponse.json({ error: 'Erro ao listar os usos do cupom' }, { status: 500 })
  }

  return NextResponse.json({ usos: data ?? [] })
}
