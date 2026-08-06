import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { createCharge } from '@/lib/services/asaas-api'
import { pickChargeFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Mesma correção aplicada em /api/membros: `cobrancas_membros` era lida pelo
// browser com a anon key, sujeita ao RLS. Além disso a criação no Asaas rodava
// no cliente, onde ASAAS_API_KEY (variável só de servidor) é string vazia — a
// chamada falhava sempre e o erro era engolido por um console.warn.

// GET /api/cobrancas-membros?membro_id=1
// GET /api/cobrancas-membros?filter=overdue|upcoming
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const params = request.nextUrl.searchParams
    const supabase = getAdminClient()
    let query = supabase.from('cobrancas_membros').select('*')

    const filter = params.get('filter')
    const membroId = params.get('membro_id')

    if (membroId) {
      const id = Number.parseInt(membroId, 10)
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: 'membro_id inválido' }, { status: 400 })
      }
      query = query.eq('membro_id', id).order('data_vencimento', { ascending: false })
    } else if (filter === 'overdue') {
      const today = new Date().toISOString().split('T')[0]
      query = query
        .eq('status', 'pendente')
        .lt('data_vencimento', today)
        .order('data_vencimento', { ascending: true })
    } else if (filter === 'upcoming') {
      const now = new Date()
      const todayStr = now.toISOString().split('T')[0]
      const sevenDaysStr = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
      query = query
        .eq('status', 'pendente')
        .gte('data_vencimento', todayStr)
        .lte('data_vencimento', sevenDaysStr)
        .order('data_vencimento', { ascending: true })
    } else {
      return NextResponse.json(
        { error: 'Informe membro_id ou filter=overdue|upcoming' },
        { status: 400 }
      )
    }

    const { data, error } = await query
    if (error) {
      console.error('[cobrancas] Erro ao buscar cobranças:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[cobrancas] Erro inesperado no GET:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

// POST /api/cobrancas-membros
// Body: { ...cobranca, asaas_customer_id? }
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const fields = pickChargeFields(body)

    if (fields.membro_id === undefined || fields.valor === undefined || !fields.data_vencimento) {
      return NextResponse.json(
        { error: 'membro_id, valor e data_vencimento são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = getAdminClient()
    const { data: newCharge, error: insertError } = await supabase
      .from('cobrancas_membros')
      .insert([fields])
      .select()
      .single()

    if (insertError) {
      console.error('[cobrancas] Erro ao criar cobrança:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // A cobrança local já existe. A integração com o Asaas é best-effort:
    // se falhar, devolvemos a cobrança criada junto de um aviso, em vez de
    // fingir sucesso total (o comportamento anterior) ou desfazer o insert.
    const asaasCustomerId = (body as Record<string, unknown>)?.asaas_customer_id
    if (typeof asaasCustomerId === 'string' && asaasCustomerId) {
      try {
        const { data: asaasCharge, error: asaasError } = await createCharge({
          customer: asaasCustomerId,
          value: Number(fields.valor),
          dueDate: String(fields.data_vencimento),
          billingType: 'BOLETO',
          description: String(fields.descricao || ''),
          externalReference: `MEMBRO_${fields.membro_id}_${newCharge.id}`,
        })

        if (asaasError) throw new Error(String(asaasError))

        const asaasId = (asaasCharge as { id?: string } | null)?.id
        if (asaasId) {
          const { data: updated } = await supabase
            .from('cobrancas_membros')
            .update({ asaas_payment_id: asaasId })
            .eq('id', newCharge.id)
            .select()
            .single()

          return NextResponse.json({ data: updated || newCharge }, { status: 201 })
        }
      } catch (asaasErr) {
        console.warn('[cobrancas] Falha ao criar cobrança no Asaas:', asaasErr)
        return NextResponse.json(
          {
            data: newCharge,
            warning: 'Cobrança criada localmente, mas não foi possível registrá-la no Asaas.',
          },
          { status: 201 }
        )
      }
    }

    return NextResponse.json({ data: newCharge }, { status: 201 })
  } catch (err) {
    console.error('[cobrancas] Erro inesperado no POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
