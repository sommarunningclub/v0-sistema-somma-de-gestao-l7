import { NextRequest, NextResponse } from 'next/server'
import { getTasks, createTask } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'

const VALID_PRIORIDADES = TAREFAS_PRIORIDADES.map(p => p.id)

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('board_id')
  if (!boardId) return NextResponse.json({ error: 'board_id obrigatório' }, { status: 400 })
  const tasks = await getTasks(boardId)
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { column_id, board_id, titulo, descricao, prioridade, responsavel_id, responsavel_nome, data_entrega, checklist } = body

    if (!column_id || !board_id || !titulo) {
      return NextResponse.json({ error: 'column_id, board_id e titulo são obrigatórios' }, { status: 400 })
    }

    const task = await createTask({
      column_id,
      board_id,
      titulo,
      descricao: descricao || null,
      prioridade: VALID_PRIORIDADES.includes(prioridade) ? prioridade : 'media',
      responsavel_id: responsavel_id || null,
      responsavel_nome: responsavel_nome || null,
      data_entrega: data_entrega || null,
      posicao: 0,
      concluida: false,
      checklist: Array.isArray(checklist) ? checklist : [],
    })

    if (!task) return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error('[v0] tasks POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
