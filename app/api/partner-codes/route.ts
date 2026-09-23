import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import {
  TABELA_VINCULOS,
  chaveContagem,
  codigoValido,
  contarInscricoes,
  montarLink,
  normalizarCodigo,
  normalizarEventoIds,
  type CodigoParceiro,
  type EventoParaVinculo,
} from '@/lib/parceiros/vinculos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type VinculoRow = {
  codigo_id: string
  evento_id: string
  eventos: EventoParaVinculo | EventoParaVinculo[] | null
}

/**
 * Monta os eventos de cada código com link pronto e inscrições atribuídas.
 *
 * As três consultas (códigos, vínculos, participantes) rodam separadas de
 * propósito: a atribuição vive em `evento_participantes.parceiro_slug`, um
 * texto livre gravado pelo site, e não há chave estrangeira para o PostgREST
 * seguir até ela.
 */
async function montarCodigosComEventos(
  supabase: ReturnType<typeof getAdminClient>,
  codigos: Array<Omit<CodigoParceiro, 'eventos'>>
): Promise<CodigoParceiro[]> {
  if (codigos.length === 0) return []

  const { data: vinculos, error: erroVinculos } = await supabase
    .from(TABELA_VINCULOS)
    .select('codigo_id, evento_id, eventos(id, titulo, data_evento, slug, lp_url)')
    .in(
      'codigo_id',
      codigos.map((c) => c.id)
    )

  if (erroVinculos) {
    console.error('[partner-codes] Erro ao carregar vínculos:', erroVinculos)
    // Sem os vínculos a listagem ainda vale: o código continua existindo.
    return codigos.map((c) => ({ ...c, eventos: [] }))
  }

  const { data: participantes } = await supabase
    .from('evento_participantes')
    .select('evento_id, parceiro_slug')
    .not('parceiro_slug', 'is', null)

  const contagem = contarInscricoes(participantes ?? [])

  return codigos.map((codigo) => {
    const eventos = ((vinculos ?? []) as VinculoRow[])
      .filter((v) => v.codigo_id === codigo.id)
      .map((v) => {
        // O embed do PostgREST vem como objeto ou array conforme a inferência
        // do relacionamento; normalizar aqui evita o `[0]` espalhado na tela.
        const evento = (Array.isArray(v.eventos) ? v.eventos[0] : v.eventos) ?? null
        if (!evento) return null
        return {
          ...evento,
          link: montarLink(evento, codigo.codigo),
          inscricoes: contagem.get(chaveContagem(codigo.codigo, evento.id)) ?? 0,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => a.data_evento.localeCompare(b.data_evento))

    return { ...codigo, eventos }
  })
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const { data, error } = await supabase
      .from('codigo_parceiro')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ data: await montarCodigosComEventos(supabase, data || []) })
  } catch (error) {
    console.error('[partner-codes] Erro ao listar códigos:', error)
    return NextResponse.json({ error: 'Erro ao carregar os códigos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const supabase = getAdminClient()
  try {
    const body = await request.json()
    const codigo = normalizarCodigo(body?.codigo)
    const nome_parceiro = String(body?.nome_parceiro ?? '').trim()
    const eventoIds = normalizarEventoIds(body?.evento_ids)

    if (!codigo || !nome_parceiro) {
      return NextResponse.json(
        { error: 'Código e nome do parceiro são obrigatórios' },
        { status: 400 }
      )
    }
    if (!codigoValido(codigo)) {
      return NextResponse.json(
        {
          error:
            'Código deve ter de 3 a 30 caracteres, usando apenas letras, números, hífen ou underline',
        },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('codigo_parceiro')
      .insert([{ codigo, nome_parceiro, ativo: true, created_at: new Date().toISOString() }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: `O código ${codigo} já existe` }, { status: 409 })
      }
      throw error
    }

    // Os vínculos vêm depois do código porque dependem do id dele. Se falharem,
    // o código continua criado e utilizável — a tela avisa e a pessoa vincula
    // de novo, em vez de perder o cadastro inteiro por causa do anexo.
    let aviso: string | undefined
    if (eventoIds.length > 0) {
      const { error: erroVinculo } = await supabase.from(TABELA_VINCULOS).insert(
        eventoIds.map((evento_id) => ({
          codigo_id: data.id,
          evento_id,
          created_by: auth.session.email ?? null,
        }))
      )
      if (erroVinculo) {
        console.error('[partner-codes] Erro ao vincular eventos:', erroVinculo)
        aviso = 'Código criado, mas os eventos não foram vinculados. Tente vincular de novo.'
      }
    }

    const [completo] = await montarCodigosComEventos(supabase, [data])

    console.log('[partner-codes] Código', codigo, 'criado por', auth.session.email)
    return NextResponse.json({ data: completo, aviso, message: 'Código criado com sucesso' })
  } catch (error) {
    console.error('[partner-codes] Erro ao criar código:', error)
    return NextResponse.json({ error: 'Erro ao criar o código' }, { status: 500 })
  }
}
