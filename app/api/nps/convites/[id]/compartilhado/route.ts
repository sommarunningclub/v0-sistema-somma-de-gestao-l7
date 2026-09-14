import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { marcarConviteCompartilhado } from '@/lib/services/nps'
import { ID_INVALIDO, idValido, json, respostaDeErro } from '@/lib/nps/http'

/** Registra a primeira vez que o link pessoal foi copiado ou enviado pelo WhatsApp. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth
  const { id } = await params
  if (!idValido(id)) return json(ID_INVALIDO, 400)

  try {
    await marcarConviteCompartilhado(id, auth.session.email)
    return json({ ok: true })
  } catch (err) {
    return respostaDeErro(err, 'POST /api/nps/convites/[id]/compartilhado')
  }
}
