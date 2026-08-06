import { NextRequest, NextResponse } from 'next/server'
import { getEscalaDoEvento, getPelotoesDoEvento, upsertEscalacao } from '@/lib/services/escala'
import { validarEscalacao } from '@/lib/escala-rules'
import type { EscalaInsiderInput } from '@/lib/types/escala'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  const { eventoId } = await params
  const escala = await getEscalaDoEvento(eventoId)
  if (!escala) {
    return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
  }
  return NextResponse.json(escala)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  try {
    const { eventoId } = await params
    const body = await req.json()

    const input: EscalaInsiderInput = {
      insider_id: body.insider_id,
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

    const erro = validarEscalacao(input, pelotoes)
    if (erro) return NextResponse.json({ error: erro }, { status: 400 })

    const escalacao = await upsertEscalacao(eventoId, input)
    if (!escalacao) {
      return NextResponse.json({ error: 'Erro ao salvar a escalação' }, { status: 500 })
    }
    return NextResponse.json(escalacao, { status: 201 })
  } catch (err) {
    console.error('[escala] evento POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
