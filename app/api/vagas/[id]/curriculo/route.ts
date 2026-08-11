import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BUCKET = 'curriculos'
/** Curto de propósito: a URL sai do painel e vira link compartilhável. */
const TTL_SEGUNDOS = 60 * 5

/**
 * Devolve uma URL assinada para baixar o currículo do candidato.
 *
 * O bucket é privado e não tem policy para a anon key: sem passar por aqui,
 * com a permissão `vagas`, não há como alcançar o arquivo.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'vagas')
  if (auth instanceof NextResponse) return auth

  const { id } = await params

  try {
    const supabase = getAdminClient()

    const { data: candidato, error } = await supabase
      .from('candidatos_vagas')
      .select('curriculo_path, curriculo_nome, nome')
      .eq('id', id)
      .single()

    if (error || !candidato) {
      return NextResponse.json({ error: 'Candidato não encontrado.' }, { status: 404 })
    }

    if (!candidato.curriculo_path) {
      return NextResponse.json(
        { error: 'Este candidato não tem currículo anexado.' },
        { status: 404 },
      )
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(candidato.curriculo_path, TTL_SEGUNDOS, {
        download: candidato.curriculo_nome ?? true,
      })

    if (signedError || !signed?.signedUrl) {
      console.error('[vagas] Erro ao assinar URL do currículo:', signedError)
      return NextResponse.json(
        { error: 'Não foi possível abrir o currículo.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ url: signed.signedUrl, nome: candidato.curriculo_nome })
  } catch (err) {
    console.error('[vagas] Erro inesperado ao buscar currículo:', err)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
