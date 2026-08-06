import { NextRequest, NextResponse } from 'next/server'
import { updateAtividade, removeAtividade } from '@/lib/services/escala'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const updates: Record<string, unknown> = {}

    if (typeof body.nome === 'string') {
      const nome = body.nome.trim()
      if (!nome) return NextResponse.json({ error: 'Informe o nome da atividade' }, { status: 400 })
      updates.nome = nome
    }
    if ('descricao' in body) {
      updates.descricao = typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : null
    }
    if (typeof body.cor === 'string' && body.cor) updates.cor = body.cor
    if (typeof body.ativo === 'boolean') updates.ativo = body.ativo

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const atividade = await updateAtividade(id, updates)
    if (!atividade) {
      return NextResponse.json({ error: 'Atividade não encontrada' }, { status: 404 })
    }
    return NextResponse.json(atividade)
  } catch (err) {
    console.error('[escala] atividades PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const resultado = await removeAtividade(id)
    if (resultado === 'erro') {
      return NextResponse.json({ error: 'Erro ao remover atividade' }, { status: 500 })
    }
    return NextResponse.json({ resultado })
  } catch (err) {
    console.error('[escala] atividades DELETE:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
