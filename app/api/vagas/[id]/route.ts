import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { isEtapa } from '@/lib/vagas-constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Atualiza a triagem de um candidato: etapa e observações.
 *
 * Só esses dois campos são graváveis. Os dados que o candidato enviou são
 * registro do que ele declarou — se o painel pudesse editá-los, a ficha
 * deixaria de valer como prova do que foi recebido.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'vagas')
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const body = await request.json()
    const patch: { status?: string; observacoes?: string | null } = {}

    if ('status' in body) {
      if (!isEtapa(body.status)) {
        return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 })
      }
      patch.status = body.status
    }

    if ('observacoes' in body) {
      const obs = body.observacoes
      if (obs !== null && typeof obs !== 'string') {
        return NextResponse.json({ error: 'Observações inválidas.' }, { status: 400 })
      }
      if (typeof obs === 'string' && obs.length > 5000) {
        return NextResponse.json({ error: 'Observações muito longas.' }, { status: 400 })
      }
      patch.observacoes = typeof obs === 'string' ? obs.trim() || null : null
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
    }

    const { data, error } = await getAdminClient()
      .from('candidatos_vagas')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[vagas] Erro ao atualizar candidato:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[vagas] Erro inesperado no PATCH:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
