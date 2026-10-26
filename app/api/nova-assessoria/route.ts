import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { carregarEventos, carregarRodizio } from '@/lib/services/nova-assessoria'
import { PERIODOS, type Periodo } from '@/lib/nova-assessoria/resumo'

/** Visitas e contatos da BORA no período, mais o estado do rodízio. */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'novaAssessoria')
  if (auth instanceof NextResponse) return auth

  const pedido = req.nextUrl.searchParams.get('periodo') as Periodo | null
  const periodo: Periodo = pedido && PERIODOS.includes(pedido) ? pedido : '30d'

  try {
    const [rodizio, { eventos, truncado }] = await Promise.all([carregarRodizio(), carregarEventos(periodo)])
    // Carrega nome e WhatsApp de quem pediu contato: nunca em cache.
    return NextResponse.json({ periodo, rodizio, eventos, truncado }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[nova-assessoria] GET /api/nova-assessoria:', err)
    return NextResponse.json(
      { error: 'Não foi possível carregar os dados. Tente de novo em instantes.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
