import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inscritos pela LP do site (`evento_participantes`) que ainda não estão em
 * `checkins` — a lista que este painel e o balcão do dia leem.
 *
 * Desde 23/09/2026 o site espelha cada inscrição nova na hora. Este módulo
 * cobre quem entrou antes disso (ou quando o espelho do site falhar): conta
 * essas pessoas no total do evento e as copia para a lista quando a gestão
 * pedir. Idempotente por CPF + evento, nas duas grafias do CPF.
 */

export interface ParticipanteLp {
  id: string
  evento_id: string
  pessoa_id: number | null
  cpf: string
  nome_completo: string
  email: string | null
  telefone: string | null
  pelotao: string | null
  status: string
  criado_em: string
}

export const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

/**
 * Participantes cujo CPF não aparece em `cpfsNaLista` (qualquer grafia).
 * Também não repete um CPF que apareça duas vezes entre os participantes.
 */
export function foraDaLista<T extends { cpf: string }>(
  participantes: T[],
  cpfsNaLista: Iterable<unknown>
): T[] {
  const naLista = new Set<string>()
  for (const c of cpfsNaLista) {
    const d = soDigitos(c)
    if (d) naLista.add(d)
  }
  const vistos = new Set<string>()
  const fora: T[] = []
  for (const p of participantes) {
    const d = soDigitos(p.cpf)
    if (!d || naLista.has(d) || vistos.has(d)) continue
    vistos.add(d)
    fora.push(p)
  }
  return fora
}

const PAGINA = 1000

/** CPFs de `checkins` do evento, paginando para passar do teto de 1000 linhas do PostgREST. */
export async function cpfsNaLista(supabase: SupabaseClient, eventoId: string): Promise<string[]> {
  const cpfs: string[] = []
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from('checkins')
      .select('cpf')
      .eq('evento_id', eventoId)
      .range(de, de + PAGINA - 1)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) cpfs.push(String(r.cpf ?? ''))
    if (!data || data.length < PAGINA) break
  }
  return cpfs
}

/** Inscritos pela LP (não cancelados), agrupados por evento. `eventoId` restringe a um evento. */
export async function participantesLpPorEvento(
  supabase: SupabaseClient,
  eventoId?: string
): Promise<Map<string, ParticipanteLp[]>> {
  const mapa = new Map<string, ParticipanteLp[]>()
  for (let de = 0; ; de += PAGINA) {
    let query = supabase
      .from('evento_participantes')
      .select('id, evento_id, pessoa_id, cpf, nome_completo, email, telefone, pelotao, status, criado_em')
      .neq('status', 'cancelado')
      .range(de, de + PAGINA - 1)
    if (eventoId) query = query.eq('evento_id', eventoId)
    const { data, error } = await query
    if (error) {
      // A tabela nasceu com o SOMMA DAY de set/2026. Onde ela não existe, não há inscrito pela LP.
      if (error.code === '42P01') return mapa
      throw new Error(error.message)
    }
    for (const p of (data ?? []) as ParticipanteLp[]) {
      const lista = mapa.get(p.evento_id) ?? []
      lista.push(p)
      mapa.set(p.evento_id, lista)
    }
    if (!data || data.length < PAGINA) break
  }
  return mapa
}

/** Quantos inscritos pela LP faltam na lista, por evento (só eventos que têm inscrição pela LP). */
export async function contarForaDaListaPorEvento(supabase: SupabaseClient): Promise<Record<string, number>> {
  const porEvento = await participantesLpPorEvento(supabase)
  const contagem: Record<string, number> = {}
  await Promise.all(
    [...porEvento.entries()].map(async ([eventoId, parts]) => {
      contagem[eventoId] = foraDaLista(parts, await cpfsNaLista(supabase, eventoId)).length
    })
  )
  return contagem
}

/**
 * Copia para `checkins` quem se inscreveu pela LP e ainda não está lá, no
 * mesmo formato que o /api/checkin do site grava. Devolve quantos entraram e
 * quantos ainda faltam (normalmente zero).
 */
export async function espelharForaDaLista(
  supabase: SupabaseClient,
  eventoId: string
): Promise<{ inseridos: number; restantes: number }> {
  const { data: evento, error: erroEvento } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento')
    .eq('id', eventoId)
    .maybeSingle()
  if (erroEvento) throw new Error(erroEvento.message)
  if (!evento) throw new Error('Evento não encontrado')

  const parts = (await participantesLpPorEvento(supabase, eventoId)).get(eventoId) ?? []
  const novos = foraDaLista(parts, await cpfsNaLista(supabase, eventoId))
  if (novos.length === 0) return { inseridos: 0, restantes: 0 }

  // O formulário da LP não pergunta sexo; se a base de pessoas já sabe, vai junto.
  const sexoPor = new Map<number, string | null>()
  const pessoaIds = novos.map(p => p.pessoa_id).filter((v): v is number => typeof v === 'number')
  if (pessoaIds.length > 0) {
    const { data } = await supabase.from('cadastro_site').select('id, sexo').in('id', pessoaIds)
    for (const r of data ?? []) sexoPor.set(Number(r.id), (r.sexo as string | null) ?? null)
  }

  const linhas = novos.map(p => ({
    nome_completo: p.nome_completo,
    email: p.email,
    telefone: p.telefone,
    cpf: soDigitos(p.cpf),
    sexo: p.pessoa_id != null ? (sexoPor.get(p.pessoa_id) ?? null) : null,
    pelotao: p.pelotao,
    data_do_evento: evento.data_evento ?? '',
    nome_do_evento: evento.titulo ?? '',
    evento_id: evento.id,
    data_hora_checkin: p.criado_em,
    validacao_do_checkin: false,
  }))

  const { error } = await supabase.from('checkins').insert(linhas)
  if (error) throw new Error(error.message)

  const restantes = foraDaLista(parts, await cpfsNaLista(supabase, eventoId)).length
  return { inseridos: linhas.length, restantes }
}

/* ─── Sincronização ao carregar a lista ─────────────────────────────────── */

/** Desliga a sincronização automática sem deploy: `CHECKIN_SINCRONIZAR_LP=off` na Vercel. */
export function sincronizacaoLigada(): boolean {
  return (process.env.CHECKIN_SINCRONIZAR_LP ?? '').trim().toLowerCase() !== 'off'
}

export interface ResultadoSincronizacao {
  inseridos: number
  restantes: number
  erro?: string
}

const emAndamento = new Map<string, Promise<ResultadoSincronizacao>>()

/**
 * Traz para `checkins` quem se inscreveu pela LP e ainda não está lá, sem
 * nunca derrubar quem chamou: erro vira `erro` na resposta e fica no log.
 * Duas chamadas simultâneas para o mesmo evento (duas pessoas abrindo a
 * lista ao mesmo tempo) compartilham a mesma execução, para não inserir a
 * mesma pessoa duas vezes.
 */
export async function sincronizarInscritosLp(
  supabase: SupabaseClient,
  eventoId: string
): Promise<ResultadoSincronizacao> {
  if (!sincronizacaoLigada()) return { inseridos: 0, restantes: 0 }
  const pendente = emAndamento.get(eventoId)
  if (pendente) return pendente

  const execucao = espelharForaDaLista(supabase, eventoId)
    .catch((err: unknown): ResultadoSincronizacao => {
      const erro = err instanceof Error ? err.message : String(err)
      console.error('[v0] Falha ao sincronizar inscritos da LP:', eventoId, erro)
      return { inseridos: 0, restantes: -1, erro }
    })
    .finally(() => { emAndamento.delete(eventoId) })
  emAndamento.set(eventoId, execucao)
  return execucao
}
