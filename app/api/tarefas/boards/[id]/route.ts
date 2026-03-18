import { NextRequest, NextResponse } from 'next/server'
import { updateBoard, deleteBoard } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const board = await updateBoard(id, { nome: body.nome, descricao: body.descricao })
    if (!board) return NextResponse.json({ error: 'Erro ao atualizar quadro' }, { status: 500 })
    return NextResponse.json(board)
  } catch (err) {
    console.error('[v0] boards PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteBoard(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar quadro' }, { status: 500 })
  return NextResponse.json({ success: true })
}
