import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { gerarConvites, listarConvites } from '@/lib/services/nps'
import { ID_INVALIDO, idValido, json, respostaDeErro } from '@/lib/nps/http'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    return json({ convites: await listarConvites(id) })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/rodadas/[id]/convites')
  }
}

/** Gera os links pessoais que faltam para os alunos ativos. Idempotente. */
export async function POST(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    return json(await gerarConvites(id))
  } catch (err) {
    return respostaDeErro(err, 'POST /api/nps/rodadas/[id]/convites')
  }
}
