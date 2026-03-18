import { NextRequest, NextResponse } from 'next/server'
import { updateColumn, deleteColumn, countTasksInColumn } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const col = await updateColumn(id, {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.cor !== undefined && { cor: body.cor }),
      ...(body.posicao !== undefined && { posicao: body.posicao }),
    })
    if (!col) return NextResponse.json({ error: 'Erro ao atualizar coluna' }, { status: 500 })
    return NextResponse.json(col)
  } catch (err) {
    console.error('[v0] columns PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Block deletion if column has tasks
  const count = await countTasksInColumn(id)
  if (count > 0) {
    return NextResponse.json(
      { error: `Mova ou exclua as ${count} tarefa(s) antes de remover a coluna.`, taskCount: count },
      { status: 409 }
    )
  }

  const success = await deleteColumn(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar coluna' }, { status: 500 })
  return NextResponse.json({ success: true })
}
