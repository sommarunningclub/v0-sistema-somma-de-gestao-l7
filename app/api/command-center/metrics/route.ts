import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// As tabelas `professors`, `professor_clients`, `payments` e
// `financial_transactions` têm RLS e são invisíveis para a role `anon`, que é
// a única que o browser tem. Lidas do cliente, todas voltavam vazias e o
// dashboard mostrava zeros como se fosse o número real.
//
// As contagens usam `head: true`, então o Postgres devolve só o total em vez
// de trafegar todas as linhas — o código anterior baixava tudo para dar length.

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'dashboard')
  if (auth instanceof NextResponse) return auth

  try {
    const supabase = getAdminClient()

    const [professors, linkedClients, pending, overdue, transactions] = await Promise.all([
      supabase
        .from('professors')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('professor_clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      // Aqui precisamos dos valores, não só da contagem, para somar.
      supabase.from('payments').select('value').eq('status', 'PENDING'),
      supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'OVERDUE'),
      supabase
        .from('financial_transactions')
        .select('transaction_type, description, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const failed = [professors, linkedClients, pending, overdue, transactions].find(r => r.error)
    if (failed?.error) {
      console.error('[command-center] Erro ao buscar métricas:', failed.error)
      return NextResponse.json({ error: failed.error.message }, { status: 500 })
    }

    const pendingRows = (pending.data || []) as Array<{ value: number | null }>

    return NextResponse.json({
      totalProfessors: professors.count || 0,
      linkedClients: linkedClients.count || 0,
      pendingPayments: pendingRows.length,
      pendingPaymentsValue: pendingRows.reduce((sum, p) => sum + (p.value || 0), 0),
      overduePayments: overdue.count || 0,
      recentActivity: (transactions.data || []).map((t: any) => ({
        type: t.transaction_type || 'transaction',
        description: t.description || 'Transação financeira',
        timestamp: t.created_at,
      })),
    })
  } catch (err) {
    console.error('[command-center] Erro inesperado:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
