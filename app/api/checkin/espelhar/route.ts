import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { espelharForaDaLista } from '@/lib/checkin/espelho-lp'

export const dynamic = 'force-dynamic'

/**
 * POST { evento_id }
 * Copia para a lista de check-in quem se inscreveu pela LP do site e ainda
 * não está nela. Idempotente: pode ser chamado quantas vezes for preciso.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'checkin')
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json().catch(() => ({}))
    const eventoId = typeof body?.evento_id === 'string' ? body.evento_id.trim() : ''
    if (!eventoId) {
      return NextResponse.json({ error: 'evento_id é obrigatório' }, { status: 400 })
    }

    const resultado = await espelharForaDaLista(getAdminClient(), eventoId)
    return NextResponse.json(resultado)
  } catch (error) {
    console.error('[v0] Error POST /api/checkin/espelhar:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao trazer inscritos da LP' },
      { status: 500 }
    )
  }
}
