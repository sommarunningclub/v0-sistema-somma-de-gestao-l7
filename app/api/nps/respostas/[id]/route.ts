import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { editarResposta, excluirResposta, obterResposta } from '@/lib/services/nps'
import { editarRespostaSchema } from '@/lib/nps/validacao'
import { ID_INVALIDO, idValido, json, lerJson, respostaDeErro } from '@/lib/nps/http'

type Contexto = { params: Promise<{ id: string }> }

/** Ficha completa de uma resposta, com a tratativa e o histórico dela. */
export async function GET(req: NextRequest, { params }: Contexto) {
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

/** Corrige nome, sobrenome ou professor. Notas e textos do aluno não se editam. */
export async function PATCH(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  const parsed = editarRespostaSchema.safeParse(await lerJson(req))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, 400)

  try {
    return json({ resposta: await editarResposta(id, parsed.data, auth.session.email) })
  } catch (err) {
    return respostaDeErro(err, 'PATCH /api/nps/respostas/[id]')
  }
}

/** Apaga a resposta. A tratativa e o histórico dela vão junto (cascade). */
export async function DELETE(req: NextRequest, { params }: Contexto) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    await excluirResposta(id, auth.session.email)
    return json({ ok: true })
  } catch (err) {
    return respostaDeErro(err, 'DELETE /api/nps/respostas/[id]')
  }
}
