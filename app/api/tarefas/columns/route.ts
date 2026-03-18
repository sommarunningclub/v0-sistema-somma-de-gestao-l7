import { NextRequest, NextResponse } from 'next/server'
import { getColumns, createColumn } from '@/lib/services/tarefas'

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('board_id')
  if (!boardId) return NextResponse.json({ error: 'board_id obrigatório' }, { status: 400 })
  const columns = await getColumns(boardId)
  return NextResponse.json(columns)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { board_id, nome, cor, posicao, criado_por } = body
    if (!board_id || !nome) return NextResponse.json({ error: 'board_id e nome são obrigatórios' }, { status: 400 })

    const col = await createColumn({
      board_id,
      nome,
      cor: cor || '#6b7280',
      posicao: posicao ?? 0,
      criado_por: criado_por || null,
    })
    if (!col) return NextResponse.json({ error: 'Erro ao criar coluna' }, { status: 500 })

    return NextResponse.json(col, { status: 201 })
  } catch (err) {
    console.error('[v0] columns POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
