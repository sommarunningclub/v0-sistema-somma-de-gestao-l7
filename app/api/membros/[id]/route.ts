import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { pickMemberFields } from '@/lib/api/writable-fields'

export const dynamic = 'force-dynamic'

// Mesmo motivo da rota pai: `cadastro_site` tem RLS e o browser só tem a role
// `anon`. Com a anon key o UPDATE/DELETE não dá erro — ele simplesmente não
// afeta nenhuma linha, e o registro "volta" ao recarregar a página.

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10)
  return Number.isInteger(id) ? id : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { data, error } = await getAdminClient()
      .from('cadastro_site')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('[membros] Erro ao buscar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[membros] Erro inesperado no GET [id]:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const fields = pickMemberFields(await request.json())
    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
    }

    // .select() devolve as linhas afetadas — sem isso um id inexistente
    // retornaria sucesso sem ter alterado nada.
    const { data, error } = await getAdminClient()
      .from('cadastro_site')
      .update(fields)
      .eq('id', id)
      .select('id, nome_completo, email, cpf, whatsapp, data_nascimento')

    if (error) {
      console.error('[membros] Erro ao atualizar membro:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Membro não encontrado (nenhum registro atualizado).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: data[0] })
  } catch (err) {
    console.error('[membros] Erro inesperado no PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission(request, 'membros')
  if (auth instanceof NextResponse) return auth

  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const admin = getAdminClient()

    // `evento_participantes.pessoa_id` referencia o membro sem ON DELETE
    // CASCADE: sem essa checagem o Postgres recusa o DELETE com um 23503 cru.
    // A inscrição é histórico do evento (ticket, pelotão, check-in), então o
    // caminho certo é barrar aqui e dizer o que precisa ser cancelado antes.
    const { data: inscricoes, error: inscricoesError } = await admin
      .from('evento_participantes')
      .select('ticket_code')
      .eq('pessoa_id', id)
      .limit(3)

    if (inscricoesError) {
      console.error('[membros] Erro ao checar inscrições do membro:', inscricoesError)
      return NextResponse.json({ error: inscricoesError.message }, { status: 500 })
    }
    if (inscricoes && inscricoes.length > 0) {
      const tickets = inscricoes.map((i) => i.ticket_code).filter(Boolean).join(', ')
      return NextResponse.json(
        {
          error: tickets
            ? `Membro possui inscrição em evento (${tickets}). Cancele a inscrição antes de excluir.`
            : 'Membro possui inscrição em evento. Cancele a inscrição antes de excluir.',
        },
        { status: 409 }
      )
    }

    const { data, error } = await admin
      .from('cadastro_site')
      .delete()
      .eq('id', id)
      .select('id')

    if (error) {
      console.error('[membros] Erro ao deletar membro:', error)
      // 23503 = foreign_key_violation. Cai aqui quando outro vínculo (fora
      // evento_participantes) segura o cadastro; a mensagem crua do Postgres
      // não ajuda quem está no painel.
      if (error.code === '23503') {
        return NextResponse.json(
          { error: 'Membro tem registros vinculados e não pode ser excluído. Remova os vínculos antes de tentar de novo.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'Membro não encontrado (nenhum registro removido).' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error('[membros] Erro inesperado no DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
