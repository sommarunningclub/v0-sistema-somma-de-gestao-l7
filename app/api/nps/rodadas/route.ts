import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { contarAlunosAtivos, criarRodada, listarRodadas } from '@/lib/services/nps'
import { criarRodadaSchema } from '@/lib/nps/validacao'
import { json, lerJson, respostaDeErro } from '@/lib/nps/http'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth

  try {
    const [dados, alunosAtivos] = await Promise.all([listarRodadas(), contarAlunosAtivos()])
    return json({ ...dados, alunos_ativos: alunosAtivos })
  } catch (err) {
    return respostaDeErro(err, 'GET /api/nps/rodadas')
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'nps')
  if (auth instanceof NextResponse) return auth

  const parsed = criarRodadaSchema.safeParse(await lerJson(req))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, 400)

  try {
    return json({ rodada: await criarRodada(parsed.data, auth.session.email) }, 201)
  } catch (err) {
    return respostaDeErro(err, 'POST /api/nps/rodadas')
  }
}
