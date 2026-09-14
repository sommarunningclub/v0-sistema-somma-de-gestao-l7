import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { obterResposta } from '@/lib/services/nps'
import { ID_INVALIDO, idValido, json, respostaDeErro } from '@/lib/nps/http'

/** Ficha completa de uma resposta, com a tratativa e o histórico dela. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    return json(await obterResposta(id))
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/respostas/[id]')
  }
}
