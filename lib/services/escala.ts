import { getAdminClient } from '@/lib/auth/api-auth'
import { estadoDoDia, resumirPelotoes } from '@/lib/escala-rules'
import { META_POR_PELOTAO } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaDiaResumo,
  EscalaInsider,
  EscalaInsiderInput,
  EscalaLoteInput,
  InsiderOption,
} from '@/lib/types/escala'

const SELECT_ESCALACAO = `
  id, evento_id, insider_id, status, pelotao, motivo, observacao,
  dados_insiders ( nome ),
  escala_insider_atividades ( escala_atividades ( * ) )
`

function mapEscalacao(row: any): EscalaInsider {
  return {
    id: row.id,
    evento_id: row.evento_id,
    insider_id: row.insider_id,
    insider_nome: row.dados_insiders?.nome ?? 'Insider removido',
    status: row.status,
    pelotao: row.pelotao,
    motivo: row.motivo,
    observacao: row.observacao,
    atividades: (row.escala_insider_atividades ?? [])
      .map((v: any) => v.escala_atividades)
      .filter(Boolean),
  }
}

// ---------- Catálogo de atividades ----------

export async function getAtividades(incluirInativas = false): Promise<EscalaAtividade[]> {
  let query = getAdminClient().from('escala_atividades').select('*').order('nome')
  if (!incluirInativas) query = query.eq('ativo', true)

  const { data, error } = await query
  if (error) {
    console.error('[escala] getAtividades:', error)
    return []
  }
  return data ?? []
}

export async function createAtividade(
  input: { nome: string; descricao: string | null; cor: string }
): Promise<EscalaAtividade | null> {
  const { data, error } = await getAdminClient()
    .from('escala_atividades')
    .insert(input)
    .select('*')
    .single()

  if (error) {
    console.error('[escala] createAtividade:', error)
    return null
  }
  return data
}

export async function updateAtividade(
  id: string,
  updates: Partial<Pick<EscalaAtividade, 'nome' | 'descricao' | 'cor' | 'ativo'>>
): Promise<EscalaAtividade | null> {
  const { data, error } = await getAdminClient()
    .from('escala_atividades')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('[escala] updateAtividade:', error)
    return null
  }
  return data
}

/** Remove de vez se nunca foi usada; senão apenas inativa (a FK é ON DELETE RESTRICT). */
export async function removeAtividade(id: string): Promise<'removida' | 'inativada' | 'erro'> {
  const supabase = getAdminClient()

  const { count } = await supabase
    .from('escala_insider_atividades')
    .select('atividade_id', { count: 'exact', head: true })
    .eq('atividade_id', id)

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from('escala_atividades').update({ ativo: false }).eq('id', id)
    if (error) {
      console.error('[escala] removeAtividade:', error)
      return 'erro'
    }
    return 'inativada'
  }

  const { error } = await supabase.from('escala_atividades').delete().eq('id', id)
  if (error) {
    // Corrida: um vínculo novo pode ter sido inserido entre o `count` e o `delete`,
    // violando a FK ON DELETE RESTRICT. Nesse caso, inativar é o comportamento correto.
    if (error.code === '23503') {
      const { error: erroInativar } = await supabase
        .from('escala_atividades')
        .update({ ativo: false })
        .eq('id', id)
      if (erroInativar) {
        console.error('[escala] removeAtividade:', erroInativar)
        return 'erro'
      }
      return 'inativada'
    }
    console.error('[escala] removeAtividade:', error)
    return 'erro'
  }
  return 'removida'
}

// ---------- Escala ----------

export async function getPelotoesDoEvento(eventoId: string): Promise<string[] | null> {
  const { data, error } = await getAdminClient()
    .from('eventos')
    .select('pelotoes')
    .eq('id', eventoId)
    .single()

  if (error || !data) return null
  return data.pelotoes ?? []
}

/** `mes` no formato 'YYYY-MM'. Retorna um resumo por evento do mês. */
export async function getEscalaDoMes(mes: string): Promise<EscalaDiaResumo[]> {
  const supabase = getAdminClient()
  const [ano, m] = mes.split('-').map(Number)
  const primeiroDia = `${mes}-01`
  const ultimoDia = `${mes}-${String(new Date(ano, m, 0).getDate()).padStart(2, '0')}`

  const { data: eventos, error } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento, horario_inicio, tipo, pelotoes')
    .gte('data_evento', primeiroDia)
    .lte('data_evento', ultimoDia)
    .order('data_evento')

  if (error || !eventos) {
    console.error('[escala] getEscalaDoMes:', error)
    return []
  }
  if (eventos.length === 0) return []

  const { data: escalacoes, error: erroEscalacoes } = await supabase
    .from('escala_insiders')
    .select('evento_id, status, pelotao')
    .in('evento_id', eventos.map((e) => e.id))

  if (erroEscalacoes) {
    console.error('[escala] getEscalaDoMes escalações:', erroEscalacoes)
  }

  return eventos.map((evento) => {
    const doEvento = (escalacoes ?? []).filter((e) => e.evento_id === evento.id)
    const pelotoes: string[] = evento.pelotoes ?? []
    const pelotoes_resumo = resumirPelotoes(pelotoes, doEvento)
    const apoio = doEvento.filter((e) => e.status === 'apoio').length

    return {
      evento_id: evento.id,
      titulo: evento.titulo,
      data_evento: evento.data_evento,
      horario_inicio: evento.horario_inicio,
      tipo: evento.tipo,
      pelotoes,
      pelotoes_resumo,
      corredores: pelotoes_resumo.reduce((soma, p) => soma + p.escalados, 0),
      meta_total: pelotoes.length * META_POR_PELOTAO,
      apoio,
      nao_vai: doEvento.filter((e) => e.status === 'nao_vai').length,
      estado: estadoDoDia(pelotoes_resumo, apoio),
    }
  })
}

export async function getEscalaDoEvento(eventoId: string): Promise<EscalaDia | null> {
  const supabase = getAdminClient()

  const { data: evento, error: erroEvento } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento, horario_inicio, tipo, pelotoes')
    .eq('id', eventoId)
    .single()

  if (erroEvento || !evento) return null

  const { data: rows, error } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALACAO)
    .eq('evento_id', eventoId)

  if (error) {
    console.error('[escala] getEscalaDoEvento:', error)
    return null
  }

  const insiders = (rows ?? []).map(mapEscalacao)
  const pelotoes: string[] = evento.pelotoes ?? []
  const pelotoes_resumo = resumirPelotoes(pelotoes, insiders)
  const apoio = insiders.filter((i) => i.status === 'apoio').length

  return {
    evento_id: evento.id,
    titulo: evento.titulo,
    data_evento: evento.data_evento,
    horario_inicio: evento.horario_inicio,
    tipo: evento.tipo,
    pelotoes,
    pelotoes_resumo,
    corredores: pelotoes_resumo.reduce((soma, p) => soma + p.escalados, 0),
    meta_total: pelotoes.length * META_POR_PELOTAO,
    apoio,
    nao_vai: insiders.filter((i) => i.status === 'nao_vai').length,
    estado: estadoDoDia(pelotoes_resumo, apoio),
    insiders: insiders.sort((a, b) => a.insider_nome.localeCompare(b.insider_nome, 'pt-BR')),
  }
}

/**
 * Cria ou atualiza a escalação de vários insiders no mesmo evento — todos com a
 * mesma presença, pelotão e atividades — e sincroniza os vínculos de atividade.
 *
 * Os ids precisam vir sem repetição (garantido por `validarEscalacaoLote`): o
 * upsert é uma única instrução e o Postgres recusa tocar a mesma linha duas vezes.
 */
export async function upsertEscalacaoLote(
  eventoId: string,
  input: EscalaLoteInput
): Promise<EscalaInsider[] | null> {
  const supabase = getAdminClient()

  const registros = input.insider_ids.map((insider_id) => ({
    evento_id: eventoId,
    insider_id,
    status: input.status,
    pelotao: input.status === 'corre' ? input.pelotao ?? null : null,
    motivo: input.status === 'nao_vai' ? input.motivo ?? null : null,
    observacao: input.observacao ?? null,
  }))

  const { data: salvos, error } = await supabase
    .from('escala_insiders')
    .upsert(registros, { onConflict: 'evento_id,insider_id' })
    .select('id')

  if (error || !salvos) {
    console.error('[escala] upsertEscalacaoLote:', error)
    return null
  }

  const ids = salvos.map((s) => s.id)
  const atividadeIds = input.status === 'nao_vai' ? [] : input.atividade_ids ?? []

  const { error: erroLimparVinculos } = await supabase
    .from('escala_insider_atividades')
    .delete()
    .in('escala_insider_id', ids)

  if (erroLimparVinculos) {
    console.error('[escala] limpar vínculos de atividades:', erroLimparVinculos)
    // As linhas de escala_insiders já foram salvas; retornar null aqui é seguro porque
    // um novo retry desta mesma chamada re-sincroniza os vínculos (operação idempotente).
    return null
  }

  if (atividadeIds.length > 0) {
    const { error: erroVinculo } = await supabase.from('escala_insider_atividades').insert(
      ids.flatMap((escala_insider_id) =>
        atividadeIds.map((atividade_id) => ({ escala_insider_id, atividade_id }))
      )
    )
    if (erroVinculo) {
      console.error('[escala] vincular atividades:', erroVinculo)
      // As linhas de escala_insiders já foram salvas (upsert efetivado) e os vínculos
      // antigos já foram removidos; retornar null aqui é seguro porque um retry da mesma
      // chamada re-sincroniza os vínculos do zero (operação idempotente).
      return null
    }
  }

  const { data: completos } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALACAO)
    .in('id', ids)

  return (completos ?? []).map(mapEscalacao)
}

/** Cria ou atualiza a escalação do insider naquele evento e sincroniza as atividades. */
export async function upsertEscalacao(
  eventoId: string,
  input: EscalaInsiderInput
): Promise<EscalaInsider | null> {
  const salvos = await upsertEscalacaoLote(eventoId, {
    insider_ids: [input.insider_id],
    status: input.status,
    pelotao: input.pelotao,
    motivo: input.motivo,
    observacao: input.observacao,
    atividade_ids: input.atividade_ids,
  })
  return salvos?.[0] ?? null
}

export async function removeEscalacao(id: string): Promise<boolean> {
  const { error } = await getAdminClient().from('escala_insiders').delete().eq('id', id)
  if (error) {
    console.error('[escala] removeEscalacao:', error)
    return false
  }
  return true
}

export async function listInsiders(): Promise<InsiderOption[]> {
  const { data, error } = await getAdminClient()
    .from('dados_insiders')
    .select('id, nome')
    .order('nome')

  if (error) {
    console.error('[escala] listInsiders:', error)
    return []
  }
  return (data ?? []).filter((i) => i.nome)
}
