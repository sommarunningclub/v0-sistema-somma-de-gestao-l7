import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { salvarTratativa } from '@/lib/services/nps'
import { salvarTratativaSchema } from '@/lib/nps/validacao'
import { ID_INVALIDO, idValido, json, lerJson, respostaDeErro } from '@/lib/nps/http'

/** Status, responsável e anotação da tratativa. O autor vem da sessão, nunca do corpo. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  const parsed = salvarTratativaSchema.safeParse(await lerJson(req))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, 400)

  try {
    return json(await salvarTratativa(id, parsed.data, auth.session.email))
  } catch (err) {
    return respostaDeErro(err, 'PUT /api/nps/respostas/[id]/tratativa')
  }
}
