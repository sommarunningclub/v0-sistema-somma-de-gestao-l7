import { NextRequest, NextResponse } from 'next/server'
import { getBoards, createBoard } from '@/lib/services/tarefas'

export async function GET() {
  const boards = await getBoards()
  return NextResponse.json(boards)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, descricao, criado_por } = body
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const board = await createBoard({ nome, descricao: descricao || null, criado_por: criado_por || null })
    if (!board) return NextResponse.json({ error: 'Erro ao criar quadro' }, { status: 500 })

    return NextResponse.json(board, { status: 201 })
  } catch (err) {
    console.error('[v0] boards POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
