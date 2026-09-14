import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  contarAlunosAtivos,
  contarTratativasPendentes,
  listarRespostas,
  obterRodada,
  resumirRespostas,
  rodadaAnterior,
  tratativasDaRodada,
} from '@/lib/services/nps'
import { montarRelatorio } from '@/lib/nps/relatorio'
import { ID_INVALIDO, idValido, json, respostaDeErro } from '@/lib/nps/http'

/**
 * Tudo que a tela da rodada precisa numa ida: a rodada, o relatório (com as
 * variações sobre a rodada anterior), a lista enxuta de respostas e a base de
 * alunos ativos para a taxa de resposta.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    const rodada = await obterRodada(id)
    const [respostas, anterior, tratativas, alunosAtivos] = await Promise.all([
      listarRespostas(id),
      rodadaAnterior(rodada),
      tratativasDaRodada(id),
      contarAlunosAtivos(),
    ])

    const relatorio = montarRelatorio(respostas, {
      anteriores: anterior?.respostas,
      tratativasPendentes: contarTratativasPendentes(respostas, tratativas),
    })

    return json({
      rodada,
      relatorio,
      respostas: resumirRespostas(respostas, tratativas),
      anterior: anterior
        ? { id: anterior.rodada.id, slug: anterior.rodada.slug, reference_period: anterior.rodada.reference_period }
        : null,
      alunos_ativos: alunosAtivos,
    })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/rodadas/[id]/relatorio')
  }
}
