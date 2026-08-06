import { NextRequest, NextResponse } from 'next/server'
import { removeEscalacao } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await removeEscalacao(id)
  if (!ok) {
    return NextResponse.json({ error: 'Erro ao remover a escalação' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
