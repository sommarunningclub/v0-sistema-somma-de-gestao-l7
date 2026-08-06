import { NextRequest, NextResponse } from 'next/server'
import { getEscalaDoMes } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const mes = req.nextUrl.searchParams.get('mes')

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return NextResponse.json({ error: 'Parâmetro mes obrigatório no formato YYYY-MM' }, { status: 400 })
  }

  const dias = await getEscalaDoMes(mes)
  return NextResponse.json(dias)
}
