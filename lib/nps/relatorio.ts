import { QUESTIONARIO_V1, type OpcaoQuestionario, type PerguntaQuestionario } from './questionario'
import { rotuloDaOrigem } from './links'
import { formatarDataHora } from './periodo'
import type { CategoriaNps, MetodoIdentificacao, RespostaNps } from './tipos'

/**
 * Relatório de uma rodada, calculado a partir das respostas.
 *
 * Funções puras: recebem linhas do banco e devolvem números prontos para a
 * tela. Uma rodada tem dezenas, no máximo centenas de respostas, então somar
 * em TypeScript é simples e testável, sem view para cada recorte.
 *
 * NULL em pergunta condicional quer dizer "não foi exibida": médias e
 * percentuais sempre usam como base só quem viu a pergunta.
 */

// ─── NPS ────────────────────────────────────────────────────────────────────
export function categoriaDaNota(nota: number): CategoriaNps {
  if (nota >= 9) return 'promoter'
  if (nota >= 7) return 'passive'
  return 'detractor'
}

const arred1 = (n: number) => Math.round(n * 10) / 10
const arred2 = (n: number) => Math.round(n * 100) / 100
const pct = (parte: number, total: number) => (total > 0 ? arred1((100 * parte) / total) : 0)

export interface ResumoNps {
  total: number
  promotores: number
  neutros: number
  detratores: number
  /** % promotores − % detratores, de −100 a 100. Nulo sem respostas. */
  nps: number | null
  pctPromotores: number
  pctNeutros: number
  pctDetratores: number
}

export function resumoNps(notas: readonly number[]): ResumoNps {
  let promotores = 0
  let neutros = 0
  let detratores = 0
  for (const n of notas) {
    const c = categoriaDaNota(n)
    if (c === 'promoter') promotores++
    else if (c === 'passive') neutros++
    else detratores++
  }
  const total = notas.length
  return {
    total,
    promotores,
    neutros,
    detratores,
    nps: total > 0 ? arred1((100 * (promotores - detratores)) / total) : null,
    pctPromotores: pct(promotores, total),
    pctNeutros: pct(neutros, total),
    pctDetratores: pct(detratores, total),
  }
}

/** Zonas usuais de leitura do NPS. */
export function zonaDoNps(nps: number | null): { rotulo: string; tom: 'danger' | 'warning' | 'success' | 'neutral' } {
  if (nps === null) return { rotulo: 'Sem respostas', tom: 'neutral' }
  if (nps < 0) return { rotulo: 'Crítica', tom: 'danger' }
  if (nps < 50) return { rotulo: 'Aperfeiçoamento', tom: 'warning' }
  if (nps < 75) return { rotulo: 'Qualidade', tom: 'success' }
  return { rotulo: 'Excelência', tom: 'success' }
}

// ─── Acesso genérico às colunas ─────────────────────────────────────────────
function campoDe(r: RespostaNps, campo: string): unknown {
  return (r as unknown as Record<string, unknown>)[campo]
}

function numero(r: RespostaNps, campo: string): number | null {
  const v = campoDe(r, campo)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function media(valores: ReadonlyArray<number | null | undefined>): { media: number | null; respostas: number } {
  const validos = valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (validos.length === 0) return { media: null, respostas: 0 }
  return { media: arred2(validos.reduce((s, v) => s + v, 0) / validos.length), respostas: validos.length }
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const meio = Math.floor(ordenados.length / 2)
  return ordenados.length % 2 ? ordenados[meio] : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2)
}

const PERGUNTAS = new Map<string, PerguntaQuestionario>(QUESTIONARIO_V1.perguntas.map((p) => [p.id, p]))

export function perguntaDoCampo(campo: string): PerguntaQuestionario | undefined {
  return PERGUNTAS.get(campo)
}

// ─── Dimensões ──────────────────────────────────────────────────────────────
export interface Dimensao {
  id: string
  rotulo: string
  /** Escala 1 a 5. A média da dimensão é a média, por aluno, destes campos. */
  campos: string[]
}

export const DIMENSOES: Dimensao[] = [
  { id: 'geral', rotulo: 'Qualidade geral', campos: ['overall_quality', 'expectation_delivery'] },
  {
    id: 'professor',
    rotulo: 'Professor',
    campos: [
      'teacher_followup',
      'teacher_understands_goals',
      'teacher_whatsapp_access',
      'teacher_support_quality',
      'teacher_communication_quality',
    ],
  },
  { id: 'treinos', rotulo: 'Treinos', campos: ['training_quality', 'training_level_fit', 'training_goal_alignment'] },
  { id: 'evolucao', rotulo: 'Evolução percebida', campos: ['perceived_progress'] },
  {
    id: 'whatsapp',
    rotulo: 'Grupos de WhatsApp',
    campos: ['whatsapp_group_quality', 'whatsapp_connection', 'whatsapp_information_clarity'],
  },
  { id: 'comunidade', rotulo: 'Clima e interação', campos: ['community_climate', 'community_interaction'] },
  { id: 'pertencimento', rotulo: 'Pertencimento', campos: ['community_belonging'] },
  { id: 'domingos', rotulo: 'Encontros de domingo', campos: ['sunday_support_quality', 'sunday_value'] },
  { id: 'estrutura', rotulo: 'Estrutura presencial', campos: ['physical_structure_quality'] },
  { id: 'custo', rotulo: 'Custo-benefício', campos: ['cost_benefit'] },
]

export interface ResultadoPergunta {
  campo: string
  titulo: string
  media: number | null
  respostas: number
  /** % de notas 1 ou 2 entre quem respondeu. */
  pctBaixas: number | null
}

export interface ResultadoDimensao {
  id: string
  rotulo: string
  media: number | null
  respostas: number
  /** Diferença para a rodada anterior, em pontos da escala 1 a 5. */
  variacao: number | null
  perguntas: ResultadoPergunta[]
}

function mediaDaDimensao(respostas: readonly RespostaNps[], d: Dimensao) {
  return media(
    respostas.map((r) => {
      const valores = d.campos.map((c) => numero(r, c))
      if (valores.some((v) => v === null)) return null
      return (valores as number[]).reduce((s, v) => s + v, 0) / valores.length
    }),
  )
}

export function dimensoes(respostas: readonly RespostaNps[], anteriores: readonly RespostaNps[] = []): ResultadoDimensao[] {
  return DIMENSOES.map((d) => {
    const atual = mediaDaDimensao(respostas, d)
    const antes = anteriores.length ? mediaDaDimensao(anteriores, d) : null
    return {
      id: d.id,
      rotulo: d.rotulo,
      media: atual.media,
      respostas: atual.respostas,
      variacao: atual.media !== null && antes?.media != null ? arred2(atual.media - antes.media) : null,
      perguntas: d.campos.map((campo) => {
        const valores = respostas.map((r) => numero(r, campo)).filter((v): v is number => v !== null)
        return {
          campo,
          titulo: perguntaDoCampo(campo)?.titulo ?? campo,
          ...media(valores),
          pctBaixas: valores.length ? pct(valores.filter((v) => v <= 2).length, valores.length) : null,
        }
      }),
    }
  })
}

// ─── Distribuições ──────────────────────────────────────────────────────────
export interface Fatia {
  valor: string
  rotulo: string
  quantidade: number
  /** Sobre quem respondeu a pergunta, não sobre o total da rodada. */
  pct: number
}

const OPCOES_PERIODOS: OpcaoQuestionario[] = [
  { valor: 'morning', rotulo: 'Manhã' },
  { valor: 'afternoon', rotulo: 'Tarde' },
  { valor: 'evening', rotulo: 'Noite' },
]

function opcoesDoCampo(campo: string): OpcaoQuestionario[] {
  if (campo === 'available_periods') return OPCOES_PERIODOS
  return perguntaDoCampo(campo)?.opcoes ?? []
}

/** Escolha única, na ordem das alternativas (que já é a ordem natural da escala). */
export function distribuicao(respostas: readonly RespostaNps[], campo: string): Fatia[] {
  const respondidas = respostas.map((r) => campoDe(r, campo)).filter((v): v is string => typeof v === 'string')
  return opcoesDoCampo(campo).map((o) => {
    const quantidade = respondidas.filter((v) => v === o.valor).length
    return { valor: o.valor, rotulo: o.rotulo, quantidade, pct: pct(quantidade, respondidas.length) }
  })
}

/** Várias respostas: cada pessoa conta uma vez por opção. Ordenado do mais pedido. */
export function distribuicaoMultipla(respostas: readonly RespostaNps[], campo: string): Fatia[] {
  const listas = respostas
    .map((r) => campoDe(r, campo))
    .filter((v): v is string[] => Array.isArray(v) && v.length > 0)
  return opcoesDoCampo(campo)
    .map((o) => {
      const quantidade = listas.filter((l) => l.includes(o.valor)).length
      return { valor: o.valor, rotulo: o.rotulo, quantidade, pct: pct(quantidade, listas.length) }
    })
    .sort((a, b) => b.quantidade - a.quantidade)
}

/** Notas de 0 a 10: quantas pessoas deram cada nota. */
export function distribuicaoDeNotas(respostas: readonly RespostaNps[], campo: 'nps_score' | 'renewal_probability'): Fatia[] {
  const notas = respostas.map((r) => numero(r, campo)).filter((v): v is number => v !== null)
  return Array.from({ length: 11 }, (_, n) => {
    const quantidade = notas.filter((v) => v === n).length
    return { valor: String(n), rotulo: String(n), quantidade, pct: pct(quantidade, notas.length) }
  })
}

function contarPor(valores: string[], rotular: (v: string) => string): Fatia[] {
  const contagem = new Map<string, number>()
  for (const v of valores) contagem.set(v, (contagem.get(v) ?? 0) + 1)
  return Array.from(contagem, ([valor, quantidade]) => ({
    valor,
    rotulo: rotular(valor),
    quantidade,
    pct: pct(quantidade, valores.length),
  })).sort((a, b) => b.quantidade - a.quantidade)
}

export function porOrigem(respostas: readonly RespostaNps[]): Fatia[] {
  return contarPor(
    respostas.map((r) => r.source || 'direct'),
    rotuloDaOrigem,
  )
}

export const ROTULO_IDENTIFICACAO: Record<MetodoIdentificacao, string> = {
  invite: 'Link pessoal',
  name_match: 'Nome reconhecido',
  self_declared: 'Só o nome digitado',
}

export function porIdentificacao(respostas: readonly RespostaNps[]): Fatia[] {
  return contarPor(
    respostas.map((r) => r.identification_method),
    (v) => ROTULO_IDENTIFICACAO[v as MetodoIdentificacao] ?? v,
  )
}

// ─── Professores ────────────────────────────────────────────────────────────
export interface LinhaProfessor {
  professor: string
  identificado: boolean
  respostas: number
  nps: number | null
  detratores: number
  mediaProfessor: number | null
}

const DIMENSAO_PROFESSOR = DIMENSOES.find((d) => d.id === 'professor') as Dimensao

/**
 * NPS por professor. Só é possível para respostas vinculadas a um aluno (link
 * pessoal ou nome reconhecido); o resto aparece como "Não identificado", por
 * último, para ninguém ler o total como se fosse de um professor.
 */
export function porProfessor(respostas: readonly RespostaNps[]): LinhaProfessor[] {
  const grupos = new Map<string | null, RespostaNps[]>()
  for (const r of respostas) {
    const chave = r.professor_name?.trim() || null
    grupos.set(chave, [...(grupos.get(chave) ?? []), r])
  }
  return Array.from(grupos, ([professor, lista]) => {
    const resumo = resumoNps(lista.map((r) => r.nps_score))
    return {
      professor: professor ?? 'Não identificado',
      identificado: professor !== null,
      respostas: lista.length,
      nps: resumo.nps,
      detratores: resumo.detratores,
      mediaProfessor: mediaDaDimensao(lista, DIMENSAO_PROFESSOR).media,
    }
  }).sort((a, b) => Number(b.identificado) - Number(a.identificado) || b.respostas - a.respostas)
}

// ─── Tratativas ─────────────────────────────────────────────────────────────
/** Nota 6 ou menos no NPS ou na chance de renovar: alguém precisa conversar com o aluno. */
export const LIMITE_TRATATIVA = 6

export function precisaTratativa(r: Pick<RespostaNps, 'nps_score' | 'renewal_probability'>): boolean {
  return r.nps_score <= LIMITE_TRATATIVA || r.renewal_probability <= LIMITE_TRATATIVA
}

export function motivosDaTratativa(r: Pick<RespostaNps, 'nps_score' | 'renewal_probability'>): string[] {
  const motivos: string[] = []
  if (r.nps_score <= LIMITE_TRATATIVA) motivos.push(`Detrator · nota ${r.nps_score}`)
  if (r.renewal_probability <= LIMITE_TRATATIVA) motivos.push(`Renovação ${r.renewal_probability}/10`)
  return motivos
}

// ─── Relatório ──────────────────────────────────────────────────────────────
export interface PontoDeAtencao {
  id: string
  severidade: 'alta' | 'media'
  titulo: string
  detalhe: string
}

/** Abaixo disso, percentual de pergunta é ruído: 1 em 3 vira "33%". */
export const AMOSTRA_MINIMA = 5

export interface Relatorio {
  total: number
  nps: ResumoNps
  zona: ReturnType<typeof zonaDoNps>
  anterior: { total: number; nps: number | null } | null
  variacaoNps: number | null
  notas: Fatia[]
  renovacao: { media: number | null; emRisco: number; pctEmRisco: number }
  custoBeneficio: number | null
  tempoMedianoSegundos: number | null
  dimensoes: ResultadoDimensao[]
  semana: {
    interesse: Fatia[]
    dias: Fatia[]
    periodos: Fatia[]
    manha: Fatia[]
    noite: Fatia[]
    frequencia: Fatia[]
  }
  domingos: { frequencia: Fatia[] }
  whatsapp: { volume: Fatia[]; conteudos: Fatia[]; maisFeedback: Fatia[] }
  professores: LinhaProfessor[]
  origens: Fatia[]
  identificacao: Fatia[]
  precisamTratativa: number
  tratativasPendentes: number
  pontos: PontoDeAtencao[]
}

export function montarRelatorio(
  respostas: readonly RespostaNps[],
  opcoes: { anteriores?: readonly RespostaNps[]; tratativasPendentes?: number } = {},
): Relatorio {
  const anteriores = opcoes.anteriores ?? []
  const nps = resumoNps(respostas.map((r) => r.nps_score))
  const resumoAnterior = anteriores.length ? resumoNps(anteriores.map((r) => r.nps_score)) : null
  const renovacoes = respostas.map((r) => r.renewal_probability)
  const emRisco = renovacoes.filter((v) => v <= LIMITE_TRATATIVA).length

  const base: Omit<Relatorio, 'pontos'> = {
    total: respostas.length,
    nps,
    zona: zonaDoNps(nps.nps),
    anterior: resumoAnterior ? { total: resumoAnterior.total, nps: resumoAnterior.nps } : null,
    variacaoNps:
      nps.nps !== null && resumoAnterior?.nps != null ? arred1(nps.nps - resumoAnterior.nps) : null,
    notas: distribuicaoDeNotas(respostas, 'nps_score'),
    renovacao: { media: media(renovacoes).media, emRisco, pctEmRisco: pct(emRisco, respostas.length) },
    custoBeneficio: media(respostas.map((r) => r.cost_benefit)).media,
    tempoMedianoSegundos: mediana(
      respostas.map((r) => r.completion_seconds).filter((s): s is number => typeof s === 'number' && s < 3600),
    ),
    dimensoes: dimensoes(respostas, anteriores),
    semana: {
      interesse: distribuicao(respostas, 'weekday_training_interest'),
      dias: distribuicao(respostas, 'preferred_weekday_combination'),
      periodos: distribuicaoMultipla(respostas, 'available_periods'),
      manha: distribuicao(respostas, 'preferred_morning_time'),
      noite: distribuicao(respostas, 'preferred_evening_time'),
      frequencia: distribuicao(respostas, 'expected_weekly_frequency'),
    },
    domingos: { frequencia: distribuicao(respostas, 'sunday_frequency') },
    whatsapp: {
      volume: distribuicao(respostas, 'whatsapp_message_volume'),
      conteudos: distribuicaoMultipla(respostas, 'whatsapp_content_preferences'),
      maisFeedback: distribuicao(respostas, 'needs_more_feedback'),
    },
    professores: porProfessor(respostas),
    origens: porOrigem(respostas),
    identificacao: porIdentificacao(respostas),
    precisamTratativa: respostas.filter(precisaTratativa).length,
    tratativasPendentes: opcoes.tratativasPendentes ?? 0,
  }

  return { ...base, pontos: pontosDeAtencao(base) }
}

const somaPct = (fatias: Fatia[], valores: string[]) =>
  arred1(fatias.filter((f) => valores.includes(f.valor)).reduce((s, f) => s + f.pct, 0))

const respondentes = (fatias: Fatia[]) => fatias.reduce((s, f) => s + f.quantidade, 0)

const numeroBr = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const pctBr = (n: number) => `${numeroBr(n)}%`
const emPontos = (n: number) => `${numeroBr(Math.abs(n))} ${Math.abs(n) === 1 ? 'ponto' : 'pontos'}`

/**
 * O que merece atenção nesta rodada, em linguagem de gestão. Regras simples e
 * explícitas, para o time confiar no alerta e saber de onde ele veio.
 */
export function pontosDeAtencao(r: Omit<Relatorio, 'pontos'>): PontoDeAtencao[] {
  const pontos: PontoDeAtencao[] = []
  if (r.total === 0) return pontos

  if (r.tratativasPendentes > 0) {
    pontos.push({
      id: 'tratativas',
      severidade: 'alta',
      titulo: `${r.tratativasPendentes} ${r.tratativasPendentes === 1 ? 'aluno aguarda' : 'alunos aguardam'} tratativa`,
      detalhe: 'Detratores ou alunos com chance baixa de renovar que ainda ninguém procurou.',
    })
  }

  if (r.nps.nps !== null && r.nps.nps < 0) {
    pontos.push({
      id: 'nps-negativo',
      severidade: 'alta',
      titulo: `NPS negativo (${numeroBr(r.nps.nps)})`,
      detalhe: 'Há mais detratores do que promotores nesta rodada.',
    })
  }

  if (r.variacaoNps !== null && r.variacaoNps <= -10 && (r.anterior?.total ?? 0) >= AMOSTRA_MINIMA) {
    pontos.push({
      id: 'nps-queda',
      severidade: 'alta',
      titulo: `NPS caiu ${emPontos(r.variacaoNps)}`,
      detalhe: `Na rodada anterior o NPS foi ${r.anterior?.nps === null || r.anterior?.nps === undefined ? '-' : numeroBr(r.anterior.nps)}.`,
    })
  }

  if (r.renovacao.pctEmRisco >= 20) {
    pontos.push({
      id: 'renovacao',
      severidade: 'alta',
      titulo: `${pctBr(r.renovacao.pctEmRisco)} em risco de não renovar`,
      detalhe: `${r.renovacao.emRisco} ${r.renovacao.emRisco === 1 ? 'aluno deu' : 'alunos deram'} 6 ou menos para a chance de renovar.`,
    })
  }

  for (const d of r.dimensoes) {
    if (d.media === null || d.respostas < AMOSTRA_MINIMA) continue
    if (d.media < 3.5) {
      pontos.push({
        id: `dimensao-${d.id}`,
        severidade: d.media < 3 ? 'alta' : 'media',
        titulo: `${d.rotulo} com média ${d.media.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
        detalhe: 'Abaixo de 3,5 numa escala de 1 a 5.',
      })
    } else if (d.variacao !== null && d.variacao <= -0.3) {
      pontos.push({
        id: `dimensao-queda-${d.id}`,
        severidade: 'media',
        titulo: `${d.rotulo} caiu ${emPontos(d.variacao)}`,
        detalhe: 'Queda na média em relação à rodada anterior, na escala de 1 a 5.',
      })
    }
  }

  // Notas 1 e 2 concentradas: um alerta por dimensão, citando a pior pergunta.
  // Cinco perguntas do professor com o mesmo problema viram um aviso, não cinco.
  for (const d of r.dimensoes) {
    const criticas = d.perguntas
      .filter((p) => p.respostas >= AMOSTRA_MINIMA && (p.pctBaixas ?? 0) >= 25)
      .sort((a, b) => (b.pctBaixas ?? 0) - (a.pctBaixas ?? 0))
    if (criticas.length === 0) continue
    const pior = criticas[0]
    pontos.push({
      id: `baixas-${d.id}`,
      severidade: 'alta',
      titulo: `${pctBr(pior.pctBaixas ?? 0)} deram nota 1 ou 2 em ${d.rotulo}`,
      detalhe:
        criticas.length === 1 ? pior.titulo : `${criticas.length} perguntas nessa situação. A pior: ${pior.titulo}`,
    })
  }

  if (respondentes(r.whatsapp.maisFeedback) >= AMOSTRA_MINIMA && somaPct(r.whatsapp.maisFeedback, ['yes']) >= 40) {
    pontos.push({
      id: 'mais-feedback',
      severidade: 'media',
      titulo: `${pctBr(somaPct(r.whatsapp.maisFeedback, ['yes']))} pedem mais feedback do professor`,
      detalhe: 'Responderam "Sim" para a necessidade de mais feedback sobre a evolução.',
    })
  }

  if (respondentes(r.whatsapp.volume) >= AMOSTRA_MINIMA) {
    const alto = somaPct(r.whatsapp.volume, ['high', 'very_high'])
    const baixo = somaPct(r.whatsapp.volume, ['low', 'very_low'])
    if (alto >= 40) {
      pontos.push({
        id: 'whatsapp-volume-alto',
        severidade: 'media',
        titulo: `${pctBr(alto)} acham alto o volume de mensagens`,
        detalhe: 'Nos grupos de WhatsApp da assessoria.',
      })
    } else if (baixo >= 40) {
      pontos.push({
        id: 'whatsapp-volume-baixo',
        severidade: 'media',
        titulo: `${pctBr(baixo)} acham baixo o volume de mensagens`,
        detalhe: 'Nos grupos de WhatsApp da assessoria.',
      })
    }
  }

  return pontos.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === 'alta' ? -1 : 1))
}

// ─── CSV ────────────────────────────────────────────────────────────────────
/**
 * Célula segura para planilha. Texto aberto vem de quem respondeu: começar com
 * = + - @ faria Excel e Sheets tratarem a célula como fórmula.
 */
function celula(valor: unknown): string {
  let texto = valor === null || valor === undefined ? '' : String(valor)
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  return `"${texto.replace(/"/g, '""')}"`
}

function rotuloDaOpcao(opcoes: OpcaoQuestionario[] | undefined, valor: string): string {
  return opcoes?.find((o) => o.valor === valor)?.rotulo ?? valor
}

/** CSV com separador `;` e BOM: abre certo no Excel em português. */
export function respostasParaCsv(respostas: readonly RespostaNps[]): string {
  const colunas: Array<{ titulo: string; valor: (r: RespostaNps) => unknown }> = [
    { titulo: 'Enviada em', valor: (r) => formatarDataHora(r.submitted_at) },
    { titulo: 'Nome', valor: (r) => r.first_name },
    { titulo: 'Sobrenome', valor: (r) => r.last_name },
    { titulo: 'Professor', valor: (r) => r.professor_name },
    { titulo: 'Identificação', valor: (r) => ROTULO_IDENTIFICACAO[r.identification_method] },
    { titulo: 'Origem', valor: (r) => rotuloDaOrigem(r.source) },
  ]

  for (const p of QUESTIONARIO_V1.perguntas) {
    colunas.push({
      titulo: p.titulo,
      valor: (r) => {
        const v = campoDe(r, p.id)
        if (v === null || v === undefined) return ''
        if (Array.isArray(v)) return v.map((x) => rotuloDaOpcao(p.opcoes, String(x))).join(' | ')
        if (p.tipo === 'single') return rotuloDaOpcao(p.opcoes, String(v))
        return v
      },
    })
    if (p.id === 'nps_score') {
      colunas.push({
        titulo: 'Categoria NPS',
        valor: (r) => ({ promoter: 'Promotor', passive: 'Neutro', detractor: 'Detrator' })[r.nps_category],
      })
    }
    if (p.seguimento) {
      const s = p.seguimento
      colunas.push({
        titulo: s.rotulo,
        valor: (r) => {
          const v = campoDe(r, s.campo)
          if (Array.isArray(v)) return v.map((x) => rotuloDaOpcao(s.opcoes, String(x))).join(' | ')
          return v ?? ''
        },
      })
    }
  }

  colunas.push({
    titulo: 'Tempo de preenchimento (min)',
    valor: (r) => (typeof r.completion_seconds === 'number' ? Math.round(r.completion_seconds / 6) / 10 : ''),
  })

  const linhas = [colunas.map((c) => celula(c.titulo)).join(';')]
  for (const r of respostas) linhas.push(colunas.map((c) => celula(c.valor(r))).join(';'))
  return `\uFEFF${linhas.join('\r\n')}\r\n`
}
