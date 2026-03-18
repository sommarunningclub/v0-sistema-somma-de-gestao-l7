import { NextRequest, NextResponse } from 'next/server'
import { updateTask, moveTask, deleteTask } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Move-only shortcut (column change)
    if (body.column_id && Object.keys(body).length <= 2) {
      const success = await moveTask(id, body.column_id, body.board_id)
      if (!success) return NextResponse.json({ error: 'Erro ao mover tarefa' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const task = await updateTask(id, body)
    if (!task) return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
    return NextResponse.json(task)
  } catch (err) {
    console.error('[v0] tasks PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteTask(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar tarefa' }, { status: 500 })
  return NextResponse.json({ success: true })
}
