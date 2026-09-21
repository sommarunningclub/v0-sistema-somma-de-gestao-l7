import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { CAMPOS_CUPOM, TABELA_CUPONS, validarEntrada } from '@/lib/cupons/tipos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
 * Cupons do checkout da Assessoria — listagem e criação.
 *
 * Esta rota já existiu para validar e resgatar cupom, espelhando o que o
 * checkout fazia. Não servia mais a ninguém: exigia sessão com permissão
 * `pagamentos`, e o site tem a própria validação (NOVO-SITE-SOMMA-V3,
 * lib/checkout/cupons.ts) apontando direto para esta tabela. O caminho público
 * segue em /api/checkout/validate-coupon, que não foi tocado.
 *
 * O que se grava aqui vale no próximo checkout, sem deploy.
 */

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  const busca = new URL(request.url).searchParams.get('q')?.trim()

  let query = getAdminClient()
    .from(TABELA_CUPONS)
    .select(CAMPOS_CUPOM)
    .order('created_at', { ascending: false })
    .limit(500)

  if (busca) {
    const termo = busca.replace(/[%,]/g, '')
    query = query.or(`code.ilike.%${termo}%,description.ilike.%${termo}%`)
  }

  const { data, error } = await query

  if (error) {
    console.error('[cupons] Erro ao listar cupons:', error)
    return NextResponse.json({ error: 'Erro ao listar os cupons' }, { status: 500 })
  }

  return NextResponse.json({ cupons: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'pagamentos')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validacao = validarEntrada(body)
  if (!validacao.ok) return NextResponse.json({ error: validacao.erro }, { status: 400 })

  const { data, error } = await getAdminClient()
    .from(TABELA_CUPONS)
    .insert({ ...validacao.entrada, usage_count: 0 })
    .select(CAMPOS_CUPOM)
    .single()

  if (error) {
    // 23505 = unique_violation no índice de `code`. Não é erro de sistema: é o
    // operador criando um código que já existe, e o certo é editar o de lá.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Já existe um cupom com o código ${validacao.entrada.code}` },
        { status: 409 }
      )
    }
    console.error('[cupons] Erro ao criar cupom:', error)
    return NextResponse.json({ error: 'Erro ao criar o cupom' }, { status: 500 })
  }

  console.log('[cupons] Cupom', validacao.entrada.code, 'criado por', auth.session.email)
  return NextResponse.json({ cupom: data }, { status: 201 })
}
