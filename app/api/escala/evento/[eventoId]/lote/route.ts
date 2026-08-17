import { NextRequest, NextResponse } from 'next/server'
import { getPelotoesDoEvento, upsertEscalacaoLote } from '@/lib/services/escala'
import { validarEscalacaoLote } from '@/lib/escala-rules'
import type { EscalaLoteInput } from '@/lib/types/escala'

export const dynamic = 'force-dynamic'

/** Escala vários insiders de uma vez, todos com a mesma presença e pelotão. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  try {
    const { eventoId } = await params
    const body = await req.json()

    const input: EscalaLoteInput = {
      insider_ids: Array.isArray(body.insider_ids) ? body.insider_ids : [],
      status: body.status,
      pelotao: body.pelotao ?? null,
      motivo: body.motivo ?? null,
      observacao: body.observacao ?? null,
      atividade_ids: Array.isArray(body.atividade_ids) ? body.atividade_ids : [],
    }

    const pelotoes = await getPelotoesDoEvento(eventoId)
    if (pelotoes === null) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    const erro = validarEscalacaoLote(input, pelotoes)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const escalacoes = await upsertEscalacaoLote(eventoId, input)
    if (!escalacoes) {
      return NextResponse.json({ error: 'Erro ao salvar as escalações' }, { status: 500 })
    }
    return NextResponse.json(escalacoes, { status: 201 })
  } catch (err) {
    console.error('[escala] evento lote POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
