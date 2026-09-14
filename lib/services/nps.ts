// lib/services/nps.ts
import { randomBytes } from 'crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { QUESTIONARIO_V1 } from '@/lib/nps/questionario'
import { precisaTratativa } from '@/lib/nps/relatorio'
import { rotuloDaReferencia } from '@/lib/nps/periodo'
import { separarNomeCompleto } from '@/lib/nps/nome'
import type { AtualizarRodadaInput, CriarRodadaInput, SalvarTratativaInput } from '@/lib/nps/validacao'
import type {
  ConviteNps,
  EventoTratativa,
  PontoHistorico,
  RespostaNps,
  RespostaResumida,
  ResumoRodada,
  Rodada,
  StatusTratativa,
  Tratativa,
} from '@/lib/nps/tipos'

/**
 * Banco do módulo NPS Assessoria.
 *
 * Mesmo Supabase do site. As tabelas `nps_assessoria_*` têm RLS ligado e
 * nenhuma policy: só a service role lê e escreve, e só aqui, server-side.
 */

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new ErroNps(503, 'Banco não configurado neste ambiente.')
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const TB = {
  rodadas: 'nps_assessoria_campaigns',
  resumo: 'nps_assessoria_campaign_summary',
  respostas: 'nps_assessoria_responses',
  convites: 'nps_assessoria_invites',
  tratativas: 'nps_assessoria_followups',
  eventos: 'nps_assessoria_followup_events',
} as const

const COLUNAS_RODADA =
  'id, slug, title, survey_version, reference_period, status, opens_at, closes_at, created_at, updated_at, created_by, updated_by'
const COLUNAS_TRATATIVA = 'id, response_id, status, owner_name, resolved_at, updated_by, created_at, updated_at'
const FECHADAS: StatusTratativa[] = ['resolved', 'no_action']

/** Erro com status HTTP e mensagem que pode ir para a tela. */
export class ErroNps extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ErroNps'
  }
}

type ErroPostgrest = { code?: string; message?: string; details?: string | null }

function erroDoBanco(contexto: string, error: ErroPostgrest): ErroNps {
  const texto = `${error.message ?? ''} ${error.details ?? ''}`
  if (error.code === '23P01') {
    return new ErroNps(
      409,
      'Já existe uma rodada publicada nesse período. Ajuste as datas ou encerre a outra rodada antes.',
    )
  }
  if (error.code === '23505' && texto.includes('slug')) {
    return new ErroNps(409, 'Esse código de link já está em uso por outra rodada.')
  }
  if (error.code === '23514' && texto.includes('slug_reservado')) {
    return new ErroNps(400, 'Este código de link é reservado. Escolha outro.')
  }
  if (error.code === '23514' && texto.includes('publicada_com_abertura')) {
    return new ErroNps(400, 'Defina a data de abertura antes de publicar.')
  }
  if (error.code === '23514' && texto.includes('janela')) {
    return new ErroNps(400, 'O fechamento precisa ser depois da abertura.')
  }
  if (error.code === '23503') {
    return new ErroNps(409, 'A rodada tem respostas ou convites e não pode ser excluída.')
  }
  console.error(`[nps] ${contexto}:`, error.code, error.message)
  return new ErroNps(500, 'Erro ao acessar o banco. Tente de novo em instantes.')
}

function exigir<T>(contexto: string, resultado: { data: T | null; error: ErroPostgrest | null }): T {
  if (resultado.error) throw erroDoBanco(contexto, resultado.error)
  return resultado.data as T
}

// ─── Rodadas ────────────────────────────────────────────────────────────────
interface LinhaResumo {
  campaign_id: string
  total_responses: number
  promoters: number
  passives: number
  detractors: number
  nps: number | null
  avg_renewal_probability: number | null
}

/** Tratativa "pendente" = ninguém começou: sem linha ou ainda com status pendente. */
function pendente(tratativa: Pick<Tratativa, 'status'> | undefined): boolean {
  return !tratativa || tratativa.status === 'pending'
}

export async function listarRodadas(): Promise<{ rodadas: ResumoRodada[]; historico: PontoHistorico[] }> {
  const sb = db()
  const [rodadas, resumos, respostas, tratativas, convites] = await Promise.all([
    sb.from(TB.rodadas).select(COLUNAS_RODADA).order('opens_at', { ascending: false, nullsFirst: true }),
    sb
      .from(TB.resumo)
      .select('campaign_id, total_responses, promoters, passives, detractors, nps, avg_renewal_probability'),
    sb.from(TB.respostas).select('id, campaign_id, nps_score, renewal_probability, invite_id'),
    sb.from(TB.tratativas).select('response_id, status'),
    sb.from(TB.convites).select('id, campaign_id'),
  ])

  const listaRodadas = exigir('listarRodadas', rodadas) as Rodada[]
  const porRodada = new Map((exigir('resumo', resumos) as LinhaResumo[]).map((r) => [r.campaign_id, r]))
  const statusTratativa = new Map(
    (exigir('tratativas', tratativas) as Array<{ response_id: string; status: StatusTratativa }>).map((t) => [
      t.response_id,
      t,
    ]),
  )
  const linhasRespostas = exigir('respostas', respostas) as Array<
    Pick<RespostaNps, 'id' | 'campaign_id' | 'nps_score' | 'renewal_probability' | 'invite_id'>
  >
  const linhasConvites = exigir('convites', convites) as Array<{ id: string; campaign_id: string }>

  const contar = <T,>(lista: T[], chave: (item: T) => string) => {
    const mapa = new Map<string, number>()
    for (const item of lista) mapa.set(chave(item), (mapa.get(chave(item)) ?? 0) + 1)
    return mapa
  }
  const pendentes = contar(
    linhasRespostas.filter((r) => precisaTratativa(r) && pendente(statusTratativa.get(r.id))),
    (r) => r.campaign_id,
  )
  const respondidosPorConvite = contar(
    linhasRespostas.filter((r) => r.invite_id),
    (r) => r.campaign_id,
  )
  const convitesPorRodada = contar(linhasConvites, (c) => c.campaign_id)

  const lista: ResumoRodada[] = listaRodadas.map((r) => {
    const resumo = porRodada.get(r.id)
    return {
      ...r,
      total_responses: Number(resumo?.total_responses ?? 0),
      promoters: Number(resumo?.promoters ?? 0),
      passives: Number(resumo?.passives ?? 0),
      detractors: Number(resumo?.detractors ?? 0),
      nps: resumo?.nps == null ? null : Number(resumo.nps),
      avg_renewal_probability: resumo?.avg_renewal_probability == null ? null : Number(resumo.avg_renewal_probability),
      tratativas_pendentes: pendentes.get(r.id) ?? 0,
      convites: convitesPorRodada.get(r.id) ?? 0,
      convites_respondidos: respondidosPorConvite.get(r.id) ?? 0,
    }
  })

  const historico: PontoHistorico[] = lista
    .filter((r) => r.status !== 'draft' && r.total_responses > 0)
    .sort((a, b) => (a.opens_at ?? '').localeCompare(b.opens_at ?? ''))
    .map((r) => ({
      rodada_id: r.id,
      slug: r.slug,
      rotulo: rotuloDaReferencia(r.reference_period),
      opens_at: r.opens_at,
      total: r.total_responses,
      nps: r.nps,
    }))

  return { rodadas: lista, historico }
}

export async function obterRodada(id: string): Promise<Rodada> {
  const rodada = exigir('obterRodada', await db().from(TB.rodadas).select(COLUNAS_RODADA).eq('id', id).maybeSingle())
  if (!rodada) throw new ErroNps(404, 'Rodada não encontrada.')
  return rodada as Rodada
}

async function contarRespostas(rodadaId: string): Promise<number> {
  const { count, error } = await db()
    .from(TB.respostas)
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', rodadaId)
  if (error) throw erroDoBanco('contarRespostas', error)
  return count ?? 0
}

export async function criarRodada(input: CriarRodadaInput, autor: string): Promise<Rodada> {
  const resultado = await db()
    .from(TB.rodadas)
    .insert({
      title: input.title,
      slug: input.slug,
      reference_period: input.reference_period,
      opens_at: input.opens_at,
      closes_at: input.closes_at,
      survey_version: QUESTIONARIO_V1.versao,
      status: input.publicar ? 'active' : 'draft',
      created_by: autor,
      updated_by: autor,
    })
    .select(COLUNAS_RODADA)
    .single()
  return exigir('criarRodada', resultado) as Rodada
}

/**
 * Edição e transições de uma rodada.
 *
 * - O código do link só muda em rascunho: publicado, ele pode já estar num grupo.
 * - Encerrar fecha a janela agora (o site para de aceitar envio no mesmo instante).
 * - Reabrir exige fechamento no futuro.
 * - Voltar para rascunho só sem respostas: resposta recebida é histórico.
 */
export async function atualizarRodada(id: string, input: AtualizarRodadaInput, autor: string): Promise<Rodada> {
  const atual = await obterRodada(id)
  const agora = new Date()
  const patch: Record<string, unknown> = { updated_by: autor }

  if (input.title !== undefined) patch.title = input.title
  if (input.reference_period !== undefined) patch.reference_period = input.reference_period
  if (input.slug !== undefined && input.slug !== atual.slug) {
    if (atual.status !== 'draft') {
      throw new ErroNps(409, 'O link já pode ter sido compartilhado. O código só muda enquanto a rodada é rascunho.')
    }
    patch.slug = input.slug
  }
  if (input.opens_at !== undefined) patch.opens_at = input.opens_at
  if (input.closes_at !== undefined) patch.closes_at = input.closes_at

  const abre = (patch.opens_at as string | undefined) ?? atual.opens_at
  let fecha = (patch.closes_at as string | undefined) ?? atual.closes_at

  switch (input.acao) {
    case 'publicar':
      if (atual.status !== 'draft') throw new ErroNps(409, 'Só um rascunho pode ser publicado.')
      if (!abre || !fecha) throw new ErroNps(400, 'Defina abertura e fechamento antes de publicar.')
      patch.status = 'active'
      break
    case 'encerrar':
      if (atual.status !== 'active') throw new ErroNps(409, 'Só uma rodada publicada pode ser encerrada.')
      if (abre && new Date(abre) > agora) {
        throw new ErroNps(409, 'A rodada ainda não abriu. Para cancelar, volte para rascunho.')
      }
      patch.status = 'closed'
      if (!fecha || new Date(fecha) > agora) {
        fecha = agora.toISOString()
        patch.closes_at = fecha
      }
      break
    case 'reabrir':
      if (atual.status !== 'closed') throw new ErroNps(409, 'Só uma rodada encerrada pode ser reaberta.')
      if (!fecha || new Date(fecha) <= agora) {
        throw new ErroNps(400, 'Para reabrir, defina uma nova data de fechamento no futuro.')
      }
      patch.status = 'active'
      break
    case 'voltar_rascunho':
      if (atual.status !== 'active') throw new ErroNps(409, 'Só uma rodada publicada volta para rascunho.')
      if ((await contarRespostas(id)) > 0) {
        throw new ErroNps(409, 'A rodada já tem respostas e não pode voltar para rascunho. Encerre-a.')
      }
      patch.status = 'draft'
      break
  }

  if (abre && fecha && new Date(fecha) <= new Date(abre)) {
    throw new ErroNps(400, 'O fechamento precisa ser depois da abertura.')
  }

  const resultado = await db().from(TB.rodadas).update(patch).eq('id', id).select(COLUNAS_RODADA).single()
  return exigir('atualizarRodada', resultado) as Rodada
}

export async function excluirRodada(id: string): Promise<void> {
  const atual = await obterRodada(id)
  if (atual.status !== 'draft') {
    throw new ErroNps(409, 'Só rascunho pode ser excluído. Rodada publicada fica no histórico.')
  }
  const { error } = await db().from(TB.rodadas).delete().eq('id', id)
  if (error) throw erroDoBanco('excluirRodada', error)
}

// ─── Respostas ──────────────────────────────────────────────────────────────
export async function listarRespostas(rodadaId: string): Promise<RespostaNps[]> {
  const resultado = await db()
    .from(TB.respostas)
    .select('*')
    .eq('campaign_id', rodadaId)
    .order('submitted_at', { ascending: false })
  return exigir('listarRespostas', resultado) as RespostaNps[]
}

/** A rodada publicada imediatamente anterior, para as variações do relatório. */
export async function rodadaAnterior(rodada: Rodada): Promise<{ rodada: Rodada; respostas: RespostaNps[] } | null> {
  if (!rodada.opens_at) return null
  const resultado = await db()
    .from(TB.rodadas)
    .select(COLUNAS_RODADA)
    .neq('status', 'draft')
    .lt('opens_at', rodada.opens_at)
    .order('opens_at', { ascending: false })
    .limit(1)
  const anterior = (exigir('rodadaAnterior', resultado) as Rodada[])[0]
  if (!anterior) return null
  return { rodada: anterior, respostas: await listarRespostas(anterior.id) }
}

export async function tratativasDaRodada(rodadaId: string): Promise<Map<string, Tratativa>> {
  const resultado = await db()
    .from(TB.tratativas)
    .select(`${COLUNAS_TRATATIVA}, ${TB.respostas}!inner(campaign_id)`)
    .eq(`${TB.respostas}.campaign_id`, rodadaId)
  const linhas = exigir('tratativasDaRodada', resultado) as unknown as Tratativa[]
  return new Map(
    linhas.map((t) => [
      t.response_id,
      {
        id: t.id,
        response_id: t.response_id,
        status: t.status,
        owner_name: t.owner_name,
        resolved_at: t.resolved_at,
        updated_by: t.updated_by,
        created_at: t.created_at,
        updated_at: t.updated_at,
      },
    ]),
  )
}

export function resumirRespostas(respostas: RespostaNps[], tratativas: Map<string, Tratativa>): RespostaResumida[] {
  return respostas.map((r) => {
    const t = tratativas.get(r.id)
    return {
      id: r.id,
      full_name: r.full_name,
      professor_name: r.professor_name,
      identification_method: r.identification_method,
      source: r.source,
      nps_score: r.nps_score,
      nps_category: r.nps_category,
      renewal_probability: r.renewal_probability,
      nps_reason: r.nps_reason,
      submitted_at: r.submitted_at,
      precisa_tratativa: precisaTratativa(r),
      tratativa_status: t?.status ?? null,
      tratativa_responsavel: t?.owner_name ?? null,
    }
  })
}

export function contarTratativasPendentes(respostas: RespostaNps[], tratativas: Map<string, Tratativa>): number {
  return respostas.filter((r) => precisaTratativa(r) && pendente(tratativas.get(r.id))).length
}

export async function obterResposta(id: string): Promise<{
  resposta: RespostaNps
  rodada: Rodada
  tratativa: Tratativa | null
  eventos: EventoTratativa[]
}> {
  const sb = db()
  const resposta = exigir('obterResposta', await sb.from(TB.respostas).select('*').eq('id', id).maybeSingle()) as
    | RespostaNps
    | null
  if (!resposta) throw new ErroNps(404, 'Resposta não encontrada.')

  const [rodada, tratativa] = await Promise.all([
    obterRodada(resposta.campaign_id),
    sb.from(TB.tratativas).select(COLUNAS_TRATATIVA).eq('response_id', id).maybeSingle(),
  ])
  const linhaTratativa = exigir('tratativa', tratativa) as Tratativa | null

  let eventos: EventoTratativa[] = []
  if (linhaTratativa) {
    const resultado = await sb
      .from(TB.eventos)
      .select('id, followup_id, status, note, author, created_at')
      .eq('followup_id', linhaTratativa.id)
      .order('created_at', { ascending: true })
    eventos = exigir('eventos', resultado) as EventoTratativa[]
  }

  return { resposta, rodada, tratativa: linhaTratativa, eventos }
}

/**
 * Atualiza a tratativa e registra no histórico o que mudou. O histórico só
 * cresce: quem abrir a resposta daqui a dois meses vê quem falou com o aluno,
 * quando e o que ficou combinado.
 */
export async function salvarTratativa(
  respostaId: string,
  input: SalvarTratativaInput,
  autor: string,
): Promise<{ tratativa: Tratativa; eventos: EventoTratativa[] }> {
  const sb = db()
  const resposta = exigir('salvarTratativa:resposta', await sb.from(TB.respostas).select('id').eq('id', respostaId).maybeSingle())
  if (!resposta) throw new ErroNps(404, 'Resposta não encontrada.')

  const existente = exigir(
    'salvarTratativa:existente',
    await sb.from(TB.tratativas).select(COLUNAS_TRATATIVA).eq('response_id', respostaId).maybeSingle(),
  ) as Tratativa | null

  const status: StatusTratativa = input.status ?? existente?.status ?? 'pending'
  const fechada = FECHADAS.includes(status)
  const resolvidaEm = fechada
    ? existente?.status === status && existente.resolved_at
      ? existente.resolved_at
      : new Date().toISOString()
    : null
  const responsavel = input.owner_name !== undefined ? input.owner_name : (existente?.owner_name ?? null)

  const dados = { status, owner_name: responsavel, resolved_at: resolvidaEm, updated_by: autor }
  const gravada = existente
    ? await sb.from(TB.tratativas).update(dados).eq('id', existente.id).select(COLUNAS_TRATATIVA).single()
    : await sb
        .from(TB.tratativas)
        .insert({ ...dados, response_id: respostaId })
        .select(COLUNAS_TRATATIVA)
        .single()
  const tratativa = exigir('salvarTratativa:gravar', gravada) as Tratativa

  const novosEventos: Array<{ followup_id: string; status: StatusTratativa | null; note: string | null; author: string }> = []
  const mudouStatus = input.status !== undefined && input.status !== (existente?.status ?? null)
  const mudouResponsavel = input.owner_name !== undefined && input.owner_name !== (existente?.owner_name ?? null)
  if (mudouResponsavel) {
    novosEventos.push({
      followup_id: tratativa.id,
      status: null,
      note: responsavel ? `Responsável: ${responsavel}` : 'Responsável removido',
      author: autor,
    })
  }
  if (mudouStatus || input.note) {
    novosEventos.push({
      followup_id: tratativa.id,
      status: mudouStatus ? status : null,
      note: input.note ?? null,
      author: autor,
    })
  }
  if (novosEventos.length) {
    const { error } = await sb.from(TB.eventos).insert(novosEventos)
    if (error) throw erroDoBanco('salvarTratativa:eventos', error)
  }

  const eventos = exigir(
    'salvarTratativa:historico',
    await sb
      .from(TB.eventos)
      .select('id, followup_id, status, note, author, created_at')
      .eq('followup_id', tratativa.id)
      .order('created_at', { ascending: true }),
  ) as EventoTratativa[]

  return { tratativa, eventos }
}

// ─── Convites ───────────────────────────────────────────────────────────────
export async function listarConvites(rodadaId: string): Promise<ConviteNps[]> {
  const sb = db()
  const [convites, respostas] = await Promise.all([
    sb
      .from(TB.convites)
      .select('id, student_asaas_id, first_name, last_name, professor_name, token, opened_at, shared_at, created_at')
      .eq('campaign_id', rodadaId)
      .order('professor_name', { ascending: true, nullsFirst: false })
      .order('first_name', { ascending: true }),
    sb.from(TB.respostas).select('invite_id').eq('campaign_id', rodadaId).not('invite_id', 'is', null),
  ])
  const linhas = exigir('listarConvites', convites) as Array<Omit<ConviteNps, 'respondido' | 'telefone'>>
  const respondidos = new Set((exigir('respondidos', respostas) as Array<{ invite_id: string }>).map((r) => r.invite_id))

  const telefones = new Map<string, string>()
  const ids = linhas.map((l) => l.student_asaas_id)
  if (ids.length) {
    const resultado = await sb.from('asaas_customers_sync').select('asaas_id, mobile_phone, phone').in('asaas_id', ids)
    for (const c of (exigir('telefones', resultado) as Array<{ asaas_id: string; mobile_phone: string | null; phone: string | null }>)) {
      const numero = c.mobile_phone?.trim() || c.phone?.trim()
      if (numero) telefones.set(c.asaas_id, numero)
    }
  }

  return linhas.map((l) => ({
    ...l,
    respondido: respondidos.has(l.id),
    telefone: telefones.get(l.student_asaas_id) ?? null,
  }))
}

interface LinhaAluno {
  asaas_customer_id: string
  customer_name: string | null
  professor_id: string | null
  linked_at: string | null
  professors: { name: string | null } | Array<{ name: string | null }> | null
}

/**
 * Um link pessoal por aluno ativo (`professor_clients`). Rodar de novo cria só
 * os que faltam e nunca troca o link de quem já recebeu.
 */
export async function gerarConvites(rodadaId: string): Promise<{ criados: number; total: number }> {
  const rodada = await obterRodada(rodadaId)
  if (rodada.status === 'closed') throw new ErroNps(409, 'Rodada encerrada não gera links pessoais.')

  const sb = db()
  const [alunos, existentes] = await Promise.all([
    sb
      .from('professor_clients')
      .select('asaas_customer_id, customer_name, professor_id, linked_at, professors(name)')
      .eq('status', 'active')
      .not('asaas_customer_id', 'is', null),
    sb.from(TB.convites).select('student_asaas_id').eq('campaign_id', rodadaId),
  ])

  // O mesmo aluno com dois professores: vale o vínculo mais recente.
  const porAluno = new Map<string, LinhaAluno>()
  for (const l of exigir('gerarConvites:alunos', alunos) as unknown as LinhaAluno[]) {
    if (!l.customer_name?.trim()) continue
    const atual = porAluno.get(l.asaas_customer_id)
    if (!atual || (l.linked_at ?? '') > (atual.linked_at ?? '')) porAluno.set(l.asaas_customer_id, l)
  }
  const jaTem = new Set(
    (exigir('gerarConvites:existentes', existentes) as Array<{ student_asaas_id: string }>).map((e) => e.student_asaas_id),
  )

  const novos = [...porAluno.values()]
    .filter((a) => !jaTem.has(a.asaas_customer_id))
    .map((a) => {
      const { nome, sobrenome } = separarNomeCompleto(a.customer_name)
      const professor = Array.isArray(a.professors) ? a.professors[0] : a.professors
      return {
        campaign_id: rodadaId,
        token: randomBytes(24).toString('base64url'),
        student_asaas_id: a.asaas_customer_id,
        first_name: nome,
        last_name: sobrenome || '-',
        professor_id: a.professor_id,
        professor_name: professor?.name?.trim() || null,
      }
    })

  if (novos.length) {
    const { error } = await sb
      .from(TB.convites)
      .upsert(novos, { onConflict: 'campaign_id,student_asaas_id', ignoreDuplicates: true })
    if (error) throw erroDoBanco('gerarConvites:gravar', error)
  }

  return { criados: novos.length, total: jaTem.size + novos.length }
}

/** Primeira vez que alguém compartilhou o link. Separa "não enviado" de "enviado e não aberto". */
export async function marcarConviteCompartilhado(conviteId: string, autor: string): Promise<void> {
  const { error } = await db()
    .from(TB.convites)
    .update({ shared_at: new Date().toISOString(), shared_by: autor })
    .eq('id', conviteId)
    .is('shared_at', null)
  if (error) throw erroDoBanco('marcarConviteCompartilhado', error)
}

export async function contarAlunosAtivos(): Promise<number> {
  const resultado = await db()
    .from('professor_clients')
    .select('asaas_customer_id')
    .eq('status', 'active')
    .not('asaas_customer_id', 'is', null)
  const linhas = exigir('contarAlunosAtivos', resultado) as Array<{ asaas_customer_id: string }>
  return new Set(linhas.map((l) => l.asaas_customer_id)).size
}
