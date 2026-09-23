import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import { eventoAberto, temPaginaDeInscricao, type EventoParaVinculo } from '@/lib/parceiros/vinculos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/*
 * Eventos abertos, para o seletor do código de parceiro.
 *
 * Existe `/api/eventos/ativos`, mas ela é pública (serve o check-in) e a
 * definição de "ativo" lá inclui o estado da portaria no dia. Aqui o que
 * importa é outra coisa: para quais eventos ainda faz sentido um parceiro
 * divulgar. Rota própria, atrás da permissão do módulo.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'parceiro')
  if (auth instanceof NextResponse) return auth

  const hoje = new Date().toISOString().slice(0, 10)

  const { data, error } = await getAdminClient()
    .from('eventos')
    .select('id, titulo, data_evento, slug, lp_url, evento_encerrado')
    .gte('data_evento', hoje)
    .order('data_evento', { ascending: true })

  if (error) {
    console.error('[partner-codes] Erro ao listar eventos abertos:', error)
    return NextResponse.json({ error: 'Erro ao carregar os eventos' }, { status: 500 })
  }

  // `temPaginaDeInscricao` vai junto porque muda o que a tela pode oferecer:
  // evento sem página não gera link, e o seletor precisa dizer isso antes de
  // alguém vincular e mandar uma URL quebrada para o parceiro.
  const eventos = (data ?? [])
    .filter((e) => eventoAberto(e))
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      data_evento: e.data_evento,
      slug: e.slug,
      lp_url: e.lp_url,
      tem_pagina: temPaginaDeInscricao(e as EventoParaVinculo),
    }))

  return NextResponse.json({ eventos })
}
