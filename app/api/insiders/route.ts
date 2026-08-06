import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickInsiderFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// `dados_insiders` responde 401 para a role `anon` — lida do browser, a página
// só conseguia mostrar erro. A permissão é `pagamentos`, igual à da página
// (ver lib/auth/page-routes.ts).

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  try {
    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .select('*')
      .limit(100)

    if (error) {
      console.error('[insiders] Erro ao buscar insiders:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[insiders] Erro inesperado no GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  try {
    const fields = pickInsiderFields(await request.json())

    if (!fields.nome || !fields.cpf) {
      return NextResponse.json({ error: 'Nome e CPF são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from('dados_insiders')
      .insert([fields])
      .select()
      .single()

    if (error) {
      console.error('[insiders] Erro ao criar insider:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[insiders] Erro inesperado no POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
