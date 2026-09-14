import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { listarProfessores } from '@/lib/services/nps'
import { json, respostaDeErro } from '@/lib/nps/http'

/** Professores ativos, para corrigir o professor de uma resposta. */
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth

  try {
    return json({ professores: await listarProfessores() })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/professores')
  }
}
