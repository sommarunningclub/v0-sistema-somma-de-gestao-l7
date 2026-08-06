import { NextRequest, NextResponse } from 'next/server'
import { getAtividades, createAtividade } from '@/lib/services/escala'
import { ATIVIDADE_COR_PADRAO } from '@/lib/escala-constants'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const incluirInativas = req.nextUrl.searchParams.get('incluir_inativas') === '1'
  const atividades = await getAtividades(incluirInativas)
  return NextResponse.json(atividades)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''

    if (!nome) {
      return NextResponse.json({ error: 'Informe o nome da atividade' }, { status: 400 })
    }

    const atividade = await createAtividade({
      nome,
      descricao: typeof body.descricao === 'string' && body.descricao.trim()
        ? body.descricao.trim()
        : null,
      cor: typeof body.cor === 'string' && body.cor ? body.cor : ATIVIDADE_COR_PADRAO,
    })

    if (!atividade) {
      return NextResponse.json({ error: 'Erro ao criar atividade' }, { status: 500 })
    }
    return NextResponse.json(atividade, { status: 201 })
  } catch (err) {
    console.error('[escala] atividades POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
