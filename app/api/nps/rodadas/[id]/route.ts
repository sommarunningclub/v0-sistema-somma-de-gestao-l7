import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { atualizarRodada, excluirRodada, obterRodada } from '@/lib/services/nps'
import { atualizarRodadaSchema } from '@/lib/nps/validacao'
import { ID_INVALIDO, idValido, json, lerJson, respostaDeErro } from '@/lib/nps/http'

type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    return json({ rodada: await obterRodada(id) })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/rodadas/[id]')
  }
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  const parsed = atualizarRodadaSchema.safeParse(await lerJson(req))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, 400)

  try {
    return json({ rodada: await atualizarRodada(id, parsed.data, auth.session.email) })
  } catch (err) {
    return respostaDeErro(err, 'PATCH /api/nps/rodadas/[id]')
  }
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    await excluirRodada(id)
    return json({ ok: true })
  } catch (err) {
    return respostaDeErro(err, 'DELETE /api/nps/rodadas/[id]')
  }
}
