import { NextRequest, NextResponse } from 'next/server'
import { getPopupStats } from '@/lib/services/popups'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const stats = await getPopupStats(id)

    if (!stats) {
      return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[popups/[id]/stats] GET error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
