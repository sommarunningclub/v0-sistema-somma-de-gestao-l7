import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, requirePermission } from '@/lib/auth/api-auth'
import type {
  DashboardBlocos,
  DashboardEscalaBloco,
  DashboardPresencaBloco,
  DashboardProximosEventosBloco,
  DashboardTopCheckinsBloco,
  EscalaInsiderResumo,
  EscalaStatus,
} from '@/components/dashboard/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// As tabelas com RLS são invisíveis para a role `anon` do browser — por isso
// tudo aqui roda no servidor com o admin client. As contagens usam
// `head: true`: o Postgres devolve só o total em vez de trafegar linhas.

type AdminClient = ReturnType<typeof getAdminClient>

/** Tamanho da página do Supabase (o limite duro do PostgREST é 1000). */
const PAGINA_CHECKINS = 1000
/** Teto de segurança: acima disto o resultado é declarado parcial em vez de mentir. */
const TETO_CHECKINS = 50_000
/** Quantos eventos olhamos para trás/para frente em busca de uma escala montada. */
const JANELA_EVENTOS_ESCALA = 20
const LIMITE_PROXIMOS_EVENTOS = 5

/**
 * Executa um bloco isoladamente: se ele falhar, devolve `null` para que o
 * restante do dashboard continue funcionando e a UI possa dizer "indisponível"
 * em vez de exibir zero.
 */
async function bloco<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    console.error(`[command-center] bloco "${nome}" indisponível:`, err)
    return null
  }
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---------- Check-ins: leitura paginada + agregação em memória ----------

interface CheckinRow {
  cpf: string | null
  nome_completo: string | null
  evento_id: string | null
  validacao_do_checkin: boolean | null
  data_hora_checkin: string | null
}

/**
 * O cliente Supabase JS não faz GROUP BY, então a agregação é feita aqui — mas
 * `checkins` cresce sem teto e o PostgREST devolve no máximo 1000 linhas por
 * consulta. Lemos em páginas, só as colunas necessárias, e paramos no teto.
 */
async function lerCheckins(
  supabase: AdminClient
): Promise<{ rows: CheckinRow[]; parcial: boolean }> {
  const rows: CheckinRow[] = []

  for (let inicio = 0; inicio < TETO_CHECKINS; inicio += PAGINA_CHECKINS) {
    const fim = Math.min(inicio + PAGINA_CHECKINS, TETO_CHECKINS) - 1

    const { data, error } = await supabase
      .from('checkins')
      .select('cpf, nome_completo, evento_id, validacao_do_checkin, data_hora_checkin')
      // Ordem cronológica estável: a paginação por `range` só é confiável com
      // ordenação determinística, e a ordem também define qual grafia do nome
      // é a mais recente.
      .order('data_hora_checkin', { ascending: true })
      .order('id', { ascending: true })
      .range(inicio, fim)

    if (error) throw error

    const pagina = (data ?? []) as CheckinRow[]
    rows.push(...pagina)

    if (pagina.length < PAGINA_CHECKINS) return { rows, parcial: false }
  }

  // Saímos pelo teto: pode haver linhas não lidas.
  return { rows, parcial: true }
}

interface AgregadoMembro {
  nome: string
  validados: number
  eventos: Set<string>
}

/**
 * Agrupa por CPF — é o identificador real do membro; o `nome_completo` varia de
 * grafia entre um check-in e outro, então exibimos o mais recente.
 */
function agregarCheckins(rows: CheckinRow[], parcial: boolean): {
  topCheckins: DashboardTopCheckinsBloco
  presencaEventos: DashboardPresencaBloco
} {
  const porMembro = new Map<string, AgregadoMembro>()
  const eventosComCheckin = new Set<string>()

  for (const row of rows) {
    const cpf = (row.cpf ?? '').replace(/\D/g, '')
    if (!cpf) continue

    const membro =
      porMembro.get(cpf) ?? { nome: '', validados: 0, eventos: new Set<string>() }

    // As linhas vêm em ordem cronológica: a última grafia vista vence.
    if (row.nome_completo?.trim()) membro.nome = row.nome_completo.trim()
    if (row.validacao_do_checkin) membro.validados += 1
    if (row.evento_id) {
      membro.eventos.add(row.evento_id)
      eventosComCheckin.add(row.evento_id)
    }

    porMembro.set(cpf, membro)
  }

  const membros = Array.from(porMembro.entries()).map(([cpf, membro]) => ({
    cpf,
    nome: membro.nome || 'Sem nome registrado',
    validados: membro.validados,
    eventos: membro.eventos.size,
  }))

  const porValidados = membros
    .filter((m) => m.validados > 0)
    .sort((a, b) => b.validados - a.validados || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 5)
    .map((m) => ({ cpf: m.cpf, nome: m.nome, validados: m.validados }))

  const porPresenca = membros
    .filter((m) => m.eventos > 0)
    .sort((a, b) => b.eventos - a.eventos || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 10)
    .map((m) => ({ cpf: m.cpf, nome: m.nome, eventos: m.eventos }))

  return {
    topCheckins: {
      destaque: porValidados[0] ?? null,
      seguintes: porValidados.slice(1),
      parcial,
    },
    presencaEventos: {
      totalEventos: eventosComCheckin.size,
      membros: porPresenca,
      parcial,
    },
  }
}

// ---------- Escala dos insiders ----------

interface EventoBase {
  id: string
  titulo: string | null
  data_evento: string
  horario_inicio: string | null
  local: string | null
}

interface EscalaRow {
  id: string
  evento_id: string
  status: EscalaStatus
  pelotao: string | null
  dados_insiders: { nome: string | null } | null
  escala_insider_atividades: Array<{ escala_atividades: { nome: string | null } | null }> | null
}

/** Mesmo formato de join usado por `lib/services/escala.ts`. */
const SELECT_ESCALA = `
  id, evento_id, status, pelotao,
  dados_insiders ( nome ),
  escala_insider_atividades ( escala_atividades ( nome ) )
`

async function carregarEscala(supabase: AdminClient): Promise<DashboardEscalaBloco> {
  const hoje = hojeISO()
  const colunas = 'id, titulo, data_evento, horario_inicio, local'

  const [futuros, passados] = await Promise.all([
    supabase
      .from('eventos')
      .select(colunas)
      .gte('data_evento', hoje)
      .order('data_evento', { ascending: true })
      .limit(JANELA_EVENTOS_ESCALA),
    supabase
      .from('eventos')
      .select(colunas)
      .lt('data_evento', hoje)
      .order('data_evento', { ascending: false })
      .limit(JANELA_EVENTOS_ESCALA),
  ])

  if (futuros.error) throw futuros.error
  if (passados.error) throw passados.error

  // Preferimos o próximo evento com escala; se nenhum futuro tiver escala,
  // caímos no mais recente já realizado que tenha.
  const candidatos: Array<{ evento: EventoBase; passado: boolean }> = [
    ...((futuros.data ?? []) as EventoBase[]).map((evento) => ({ evento, passado: false })),
    ...((passados.data ?? []) as EventoBase[]).map((evento) => ({ evento, passado: true })),
  ]

  if (candidatos.length === 0) return { evento: null, insiders: [] }

  const { data, error } = await supabase
    .from('escala_insiders')
    .select(SELECT_ESCALA)
    .in(
      'evento_id',
      candidatos.map((c) => c.evento.id)
    )

  if (error) throw error

  const escalas = (data ?? []) as unknown as EscalaRow[]
  const escolhido = candidatos.find((c) => escalas.some((e) => e.evento_id === c.evento.id))

  if (!escolhido) return { evento: null, insiders: [] }

  const insiders: EscalaInsiderResumo[] = escalas
    .filter((e) => e.evento_id === escolhido.evento.id)
    .map((e) => ({
      id: e.id,
      nome: e.dados_insiders?.nome ?? 'Insider removido',
      status: e.status,
      pelotao: e.pelotao,
      atividades: (e.escala_insider_atividades ?? [])
        .map((v) => v.escala_atividades?.nome)
        .filter((nome): nome is string => Boolean(nome)),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

  return {
    evento: {
      id: escolhido.evento.id,
      titulo: escolhido.evento.titulo ?? 'Evento sem título',
      dataEvento: escolhido.evento.data_evento,
      horarioInicio: escolhido.evento.horario_inicio,
      local: escolhido.evento.local,
      passado: escolhido.passado,
    },
    insiders,
  }
}

// ---------- Próximos eventos ----------

interface EventoProximoRow extends EventoBase {
  checkin_status: string | null
}

async function carregarProximosEventos(
  supabase: AdminClient
): Promise<DashboardProximosEventosBloco> {
  const { data, error } = await supabase
    .from('eventos')
    .select('id, titulo, data_evento, horario_inicio, local, checkin_status')
    .gte('data_evento', hojeISO())
    .order('data_evento', { ascending: true })
    .order('horario_inicio', { ascending: true })
    .limit(LIMITE_PROXIMOS_EVENTOS)

  if (error) throw error

  const eventos = (data ?? []) as EventoProximoRow[]
  if (eventos.length === 0) return { eventos: [] }

  // `head: true` traz só o total, sem trafegar as linhas.
  const contagens = await Promise.all(
    eventos.map((evento) =>
      supabase
        .from('checkins')
        .select('id', { count: 'exact', head: true })
        .eq('evento_id', evento.id)
    )
  )

  return {
    eventos: eventos.map((evento, i) => {
      const contagem = contagens[i]
      if (contagem.error) {
        console.error('[command-center] contagem de inscritos falhou:', contagem.error)
      }
      return {
        id: evento.id,
        titulo: evento.titulo ?? 'Evento sem título',
        dataEvento: evento.data_evento,
        horarioInicio: evento.horario_inicio,
        local: evento.local,
        checkinStatus: evento.checkin_status,
        // Sem contagem confiável preferimos `null` a zero.
        inscritos: contagem.error ? null : contagem.count ?? 0,
      }
    }),
  }
}

async function carregarBlocos(supabase: AdminClient): Promise<DashboardBlocos> {
  const [agregado, escalaInsiders, proximosEventos] = await Promise.all([
    // Uma única varredura de `checkins` alimenta os dois primeiros blocos.
    bloco('checkins', async () => {
      const { rows, parcial } = await lerCheckins(supabase)
      return agregarCheckins(rows, parcial)
    }),
    bloco('escala', () => carregarEscala(supabase)),
    bloco('proximos-eventos', () => carregarProximosEventos(supabase)),
  ])

  return {
    topCheckins: agregado?.topCheckins ?? null,
    presencaEventos: agregado?.presencaEventos ?? null,
    escalaInsiders,
    proximosEventos,
  }
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'dashboard')
  if (auth instanceof NextResponse) return auth

  try {
    /*
     * O dashboard é composto apenas pelos quatro blocos operacionais.
     * Métricas financeiras e de equipe saíram do produto — as tabelas
     * continuam existindo e sendo alimentadas, só não são mais lidas aqui.
     */
    const blocos = await carregarBlocos(getAdminClient())
    return NextResponse.json(blocos)
  } catch (err) {
    console.error('[command-center] Erro inesperado:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
