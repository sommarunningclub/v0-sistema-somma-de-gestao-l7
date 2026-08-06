import { createClient } from '@supabase/supabase-js'
import { estadoDoDia, resumirPelotoes } from '@/lib/escala-rules'
import { META_POR_PELOTAO } from '@/lib/escala-constants'
import type {
  EscalaAtividade,
  EscalaDia,
  EscalaDiaResumo,
  EscalaInsider,
  EscalaInsiderInput,
  InsiderOption,
} from '@/lib/types/escala'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

const SELECT_ESCALACAO = `
  id, evento_id, insider_id, status, pelotao, motivo, observacao,
  dados_insiders ( nome ),
  escala_insider_atividades ( escala_atividades ( * ) )
`

/* eslint-disable @typescript-eslint/no-explicit-any */
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
  let query = getSupabase().from('escala_atividades').select('*').order('nome')
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
  const { data, error } = await getSupabase()
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
  const { data, error } = await getSupabase()
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
export async function removeAtividade(id: string): Promise<'removida' | 'inativada'> {
  const supabase = getSupabase()

  const { count } = await supabase
    .from('escala_insider_atividades')
    .select('atividade_id', { count: 'exact', head: true })
    .eq('atividade_id', id)

  if ((count ?? 0) > 0) {
    await supabase.from('escala_atividades').update({ ativo: false }).eq('id', id)
    return 'inativada'
  }

  await supabase.from('escala_atividades').delete().eq('id', id)
  return 'removida'
}

// ---------- Escala ----------

export async function getPelotoesDoEvento(eventoId: string): Promise<string[] | null> {
  const { data, error } = await getSupabase()
    .from('eventos')
    .select('pelotoes')
    .eq('id', eventoId)
    .single()

  if (error || !data) return null
  return data.pelotoes ?? []
}

/** `mes` no formato 'YYYY-MM'. Retorna um resumo por evento do mês. */
export async function getEscalaDoMes(mes: string): Promise<EscalaDiaResumo[]> {
  const supabase = getSupabase()
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

  const { data: escalacoes } = await supabase
    .from('escala_insiders')
    .select('evento_id, status, pelotao')
    .in('evento_id', eventos.map((e) => e.id))

  return eventos.map((evento) => {
    const doEvento = (escalacoes ?? []).filter((e) => e.evento_id === evento.id)
    const pelotoes: string[] = evento.pelotoes ?? []
    const pelotoes_resumo = resumirPelotoes(pelotoes, doEvento)

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
      apoio: doEvento.filter((e) => e.status === 'apoio').length,
      nao_vai: doEvento.filter((e) => e.status === 'nao_vai').length,
      estado: estadoDoDia(pelotoes_resumo),
    }
  })
}

export async function getEscalaDoEvento(eventoId: string): Promise<EscalaDia | null> {
  const supabase = getSupabase()

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
    apoio: insiders.filter((i) => i.status === 'apoio').length,
    nao_vai: insiders.filter((i) => i.status === 'nao_vai').length,
    estado: estadoDoDia(pelotoes_resumo),
    insiders: insiders.sort((a, b) => a.insider_nome.localeCompare(b.insider_nome, 'pt-BR')),
  }
}

/** Cria ou atualiza a escalação do insider naquele evento e sincroniza as atividades. */
export async function upsertEscalacao(
  eventoId: string,
  input: EscalaInsiderInput
): Promise<EscalaInsider | null> {
  const supabase = getSupabase()

  const registro = {
    evento_id: eventoId,
    insider_id: input.insider_id,
    status: input.status,
    pelotao: input.status === 'corre' ? input.pelotao ?? null : null,
    motivo: input.status === 'nao_vai' ? input.motivo ?? null : null,
    observacao: input.observacao ?? null,
  }

  const { data: salvo, error } = await supabase
    .from('escala_insiders')
    .upsert(registro, { onConflict: 'evento_id,insider_id' })
    .select('id')
    .single()

  if (error || !salvo) {
    console.error('[escala] upsertEscalacao:', error)
    return null
  }

  const atividadeIds = input.status === 'nao_vai' ? [] : input.atividade_ids ?? []

  await supabase.from('escala_insider_atividades').delete().eq('escala_insider_id', salvo.id)

  if (atividadeIds.length > 0) {
    const { error: erroVinculo } = await supabase.from('escala_insider_atividades').insert(
      atividadeIds.map((atividade_id) => ({
        escala_insider_id: salvo.id,
        atividade_id,
      }))
    )
    if (erroVinculo) console.error('[escala] vincular atividades:', erroVinculo)
  }

  const { data: completo } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALACAO)
    .eq('id', salvo.id)
    .single()

  return completo ? mapEscalacao(completo) : null
}

export async function removeEscalacao(id: string): Promise<boolean> {
  const { error } = await getSupabase().from('escala_insiders').delete().eq('id', id)
  if (error) {
    console.error('[escala] removeEscalacao:', error)
    return false
  }
  return true
}

export async function listInsiders(): Promise<InsiderOption[]> {
  const { data, error } = await getSupabase()
    .from('dados_insiders')
    .select('id, nome')
    .order('nome')

  if (error) {
    console.error('[escala] listInsiders:', error)
    return []
  }
  return (data ?? []).filter((i) => i.nome)
}
