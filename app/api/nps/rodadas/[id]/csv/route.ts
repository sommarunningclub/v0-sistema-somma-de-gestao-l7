import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { listarRespostas, obterRodada } from '@/lib/services/nps'
import { respostasParaCsv } from '@/lib/nps/relatorio'
import { ID_INVALIDO, idValido, json, respostaDeErro } from '@/lib/nps/http'

/** Planilha com todas as respostas da rodada (uma coluna por pergunta). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    const [rodada, respostas] = await Promise.all([obterRodada(id), listarRespostas(id)])
    return new NextResponse(respostasParaCsv(respostas), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        // O slug já passou pelo CHECK do banco: só [a-z0-9-], seguro no cabeçalho.
        'Content-Disposition': `attachment; filename="nps-${rodada.slug}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/rodadas/[id]/csv')
  }
}
