import type { RespostaNps } from '../tipos'
import {
  categoriaDaNota,
  dimensoes,
  distribuicao,
  distribuicaoMultipla,
  montarRelatorio,
  motivosDaTratativa,
  porProfessor,
  precisaTratativa,
  professorDaResposta,
  professorDivergente,
  respostasParaCsv,
  resumoNps,
  zonaDoNps,
} from '../relatorio'

let sequencia = 0

function resposta(parcial: Partial<RespostaNps> = {}): RespostaNps {
  sequencia++
  const base: RespostaNps = {
    id: `r${sequencia}`,
    campaign_id: 'c1',
    survey_version: 'assessoria_nps_v1',
    first_name: 'Ana',
    last_name: `Teste ${sequencia}`,
    full_name: `Ana Teste ${sequencia}`,
    identification_method: 'self_declared',
    invite_id: null,
    student_asaas_id: null,
    professor_id: null,
    professor_name: null,
    declared_professor: null,
    nps_score: 9,
    nps_category: 'promoter',
    nps_reason: null,
    overall_quality: 4,
    expectation_delivery: 4,
    teacher_followup: 4,
    teacher_understands_goals: 4,
    teacher_whatsapp_access: 4,
    teacher_support_quality: 4,
    teacher_communication_quality: 4,
    training_quality: 4,
    training_level_fit: 4,
    training_goal_alignment: 4,
    perceived_progress: 4,
    needs_more_feedback: 'no',
    whatsapp_group_quality: 4,
    whatsapp_connection: 4,
    whatsapp_message_volume: 'adequate',
    whatsapp_information_clarity: 4,
    whatsapp_content_preferences: ['running_tips'],
    whatsapp_content_other: null,
    community_climate: 4,
    community_belonging: 4,
    community_interaction: 4,
    community_one_word: null,
    sunday_frequency: 'every_sunday',
    sunday_support_quality: 4,
    sunday_value: 4,
    sunday_improvements: null,
    weekday_training_interest: 'no',
    preferred_weekday_combination: null,
    preferred_weekday_other: null,
    preferred_period: null,
    available_periods: null,
    preferred_morning_time: null,
    preferred_evening_time: null,
    expected_weekly_frequency: null,
    physical_structure_quality: 4,
    physical_structure_improvements: null,
    cost_benefit: 4,
    renewal_probability: 9,
    what_is_excellent: null,
    what_needs_improvement: null,
    one_change: null,
    source: 'direct',
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    device_type: 'mobile',
    started_at: '2026-09-14T12:00:00Z',
    submitted_at: '2026-09-14T12:05:00Z',
    completion_seconds: 300,
    updated_at: '2026-09-14T12:05:00Z',
    updated_by: null,
  }
  const r = { ...base, ...parcial }
  return { ...r, nps_category: categoriaDaNota(r.nps_score) }
}

const professor = (nota: number) => ({
  teacher_followup: nota,
  teacher_understands_goals: nota,
  teacher_whatsapp_access: nota,
  teacher_support_quality: nota,
  teacher_communication_quality: nota,
})

describe('NPS', () => {
  it('é % promotores − % detratores', () => {
    expect(resumoNps([10, 9, 8, 7, 6, 0])).toMatchObject({
      total: 6,
      promotores: 2,
      neutros: 2,
      detratores: 2,
      nps: 0,
      pctPromotores: 33.3,
    })
    expect(resumoNps([10, 10, 6]).nps).toBe(33.3)
    expect(resumoNps([]).nps).toBeNull()
  })

  it('classifica as zonas usuais', () => {
    expect(zonaDoNps(-5).rotulo).toBe('Crítica')
    expect(zonaDoNps(30).rotulo).toBe('Aperfeiçoamento')
    expect(zonaDoNps(60).rotulo).toBe('Qualidade')
    expect(zonaDoNps(80).rotulo).toBe('Excelência')
  })
})

describe('dimensões', () => {
  it('faz a média por aluno e compara com a rodada anterior', () => {
    const atual = [resposta(professor(5)), resposta(professor(3))]
    const anterior = [resposta(professor(4.5)), resposta(professor(4.5))]
    const prof = dimensoes(atual, anterior).find((d) => d.id === 'professor')
    expect(prof?.media).toBe(4)
    expect(prof?.variacao).toBe(-0.5)
  })

  it('ignora quem não viu a pergunta (nunca vai ao domingo)', () => {
    const lista = [
      resposta({ sunday_frequency: 'never', sunday_support_quality: null, sunday_value: null, physical_structure_quality: null }),
      resposta({ sunday_support_quality: 5, sunday_value: 5 }),
    ]
    const domingos = dimensoes(lista).find((d) => d.id === 'domingos')
    expect(domingos).toMatchObject({ media: 5, respostas: 1 })
  })

  it('mede a fatia de notas 1 e 2 por pergunta', () => {
    const lista = [1, 2, 4, 5].map((n) => resposta({ overall_quality: n }))
    const geral = dimensoes(lista).find((d) => d.id === 'geral')
    expect(geral?.perguntas.find((p) => p.campo === 'overall_quality')?.pctBaixas).toBe(50)
  })
})

describe('distribuições', () => {
  it('usa o rótulo da alternativa e a base de quem respondeu', () => {
    const lista = [
      resposta({ weekday_training_interest: 'yes', preferred_weekday_combination: 'mon_wed' }),
      resposta({ weekday_training_interest: 'yes', preferred_weekday_combination: 'tue_thu' }),
      resposta({ weekday_training_interest: 'maybe', preferred_weekday_combination: 'tue_thu' }),
      resposta({ weekday_training_interest: 'no' }),
    ]
    const dias = distribuicao(lista, 'preferred_weekday_combination')
    expect(dias.find((f) => f.valor === 'mon_wed')).toMatchObject({ rotulo: 'Segunda e quarta', quantidade: 1, pct: 33.3 })
    expect(dias.find((f) => f.valor === 'tue_thu')).toMatchObject({ quantidade: 2, pct: 66.7 })
  })

  it('conta múltipla escolha por pessoa e ordena do mais pedido', () => {
    const lista = [
      resposta({ whatsapp_content_preferences: ['race_info', 'running_tips'] }),
      resposta({ whatsapp_content_preferences: ['race_info'] }),
    ]
    const conteudos = distribuicaoMultipla(lista, 'whatsapp_content_preferences')
    expect(conteudos[0]).toMatchObject({ valor: 'race_info', quantidade: 2, pct: 100 })
    expect(conteudos[1]).toMatchObject({ valor: 'running_tips', quantidade: 1, pct: 50 })
  })

  it('traduz os períodos disponíveis', () => {
    const lista = [
      resposta({ weekday_training_interest: 'yes', preferred_period: 'multiple', available_periods: ['morning', 'evening'] }),
      resposta({ weekday_training_interest: 'yes', preferred_period: 'evening', available_periods: ['evening'] }),
    ]
    const periodos = distribuicaoMultipla(lista, 'available_periods')
    expect(periodos.map((f) => [f.rotulo, f.pct])).toEqual([
      ['Noite', 100],
      ['Manhã', 50],
      ['Tarde', 0],
    ])
  })
})

describe('professores e tratativas', () => {
  it('agrupa por professor e deixa os não identificados por último', () => {
    const lista = [
      resposta({ professor_name: null }),
      resposta({ professor_name: 'Alexandre Alves', nps_score: 9 }),
      resposta({ professor_name: 'Alexandre Alves', nps_score: 3 }),
    ]
    const linhas = porProfessor(lista)
    expect(linhas[0]).toMatchObject({ professor: 'Alexandre Alves', respostas: 2, nps: 0, detratores: 1 })
    expect(linhas[linhas.length - 1]).toMatchObject({ professor: 'Não identificado', identificado: false })
  })

  it('pede tratativa para detrator ou risco de renovação', () => {
    expect(precisaTratativa({ nps_score: 6, renewal_probability: 9 })).toBe(true)
    expect(precisaTratativa({ nps_score: 9, renewal_probability: 5 })).toBe(true)
    expect(precisaTratativa({ nps_score: 7, renewal_probability: 7 })).toBe(false)
    expect(motivosDaTratativa({ nps_score: 4, renewal_probability: 3 })).toEqual(['Detrator · nota 4', 'Renovação 3/10'])
  })
})

describe('pontos de atenção', () => {
  it('prioriza tratativas pendentes e NPS negativo', () => {
    const lista = Array.from({ length: 6 }, () => resposta({ nps_score: 3, renewal_probability: 4, overall_quality: 1 }))
    const r = montarRelatorio(lista, { tratativasPendentes: 6 })
    const ids = r.pontos.map((p) => p.id)
    expect(ids[0]).toBe('tratativas')
    expect(ids).toEqual(expect.arrayContaining(['nps-negativo', 'renovacao', 'baixas-geral']))
    expect(r.pontos.every((p, i, todos) => i === 0 || !(p.severidade === 'alta' && todos[i - 1].severidade === 'media'))).toBe(true)
  })

  it('não alerta pergunta com amostra pequena', () => {
    const lista = Array.from({ length: 3 }, () => resposta({ overall_quality: 1 }))
    expect(montarRelatorio(lista).pontos.some((p) => p.id.startsWith('baixas-'))).toBe(false)
  })

  it('agrupa perguntas da mesma dimensão num alerta só, em português', () => {
    const lista = [
      ...Array.from({ length: 2 }, () => resposta({ ...professor(1), renewal_probability: 9 })),
      ...Array.from({ length: 4 }, () => resposta({ ...professor(4), renewal_probability: 9 })),
    ]
    const r = montarRelatorio(lista)
    const doProfessor = r.pontos.filter((p) => p.id === 'baixas-professor')
    expect(doProfessor).toHaveLength(1)
    expect(doProfessor[0].titulo).toBe('33,3% deram nota 1 ou 2 em Professor')
    expect(doProfessor[0].detalhe).toMatch(/^5 perguntas nessa situação/)
    expect(r.pontos.some((p) => p.id.startsWith('pergunta-'))).toBe(false)
  })

  it('aponta queda de NPS em relação à rodada anterior', () => {
    const anteriores = Array.from({ length: 6 }, () => resposta({ nps_score: 10 }))
    const atuais = Array.from({ length: 6 }, () => resposta({ nps_score: 8 }))
    const r = montarRelatorio(atuais, { anteriores })
    expect(r.variacaoNps).toBe(-100)
    expect(r.pontos.some((p) => p.id === 'nps-queda')).toBe(true)
  })

  it('sem respostas não inventa alerta', () => {
    expect(montarRelatorio([], { tratativasPendentes: 0 }).pontos).toEqual([])
  })
})

describe('CSV', () => {
  it('abre certo no Excel e neutraliza fórmula vinda do texto aberto', () => {
    const csv = respostasParaCsv([
      resposta({ nps_reason: '=HYPERLINK("http://mal.example")', needs_more_feedback: 'no', professor_name: 'Joseph Pereira' }),
    ])
    expect(csv.startsWith('﻿')).toBe(true)
    const [cabecalho, linha] = csv.slice(1).split('\r\n')
    expect(cabecalho).toContain('"De 0 a 10, o quanto você recomendaria a Assessoria Somma Club para um amigo?"')
    expect(cabecalho.split(';').length).toBe(linha.split(';').length)
    expect(linha).toContain(`"'=HYPERLINK(""http://mal.example"")"`)
    expect(linha).toContain('"Não"')
    expect(linha).toContain('"Joseph Pereira"')
  })

  it('traz o professor com a origem e a pergunta de quem é o professor', () => {
    const csv = respostasParaCsv([resposta({ declared_professor: 'joseph_pereira' })])
    const [cabecalho, linha] = csv.slice(1).split('\r\n')
    expect(cabecalho).toContain('"Quem é o seu professor?"')
    expect(linha).toContain('"Joseph Pereira (Jojô)"')
    expect(linha).toContain('"Marcado pelo aluno"')
  })
})

describe('professor da resposta', () => {
  it('usa o cadastro e, sem ele, o que o aluno marcou', () => {
    expect(professorDaResposta({ professor_name: 'Joseph pereira', declared_professor: 'alexandre_alves' })).toEqual({
      nome: 'Joseph Pereira',
      origem: 'cadastro',
    })
    expect(professorDaResposta({ professor_name: null, declared_professor: 'mateus_fonseca' })).toEqual({
      nome: 'Mateus Fonseca',
      origem: 'informado',
    })
    expect(professorDaResposta({ professor_name: null, declared_professor: 'unknown' })).toBeNull()
    expect(professorDaResposta({ professor_name: '  ', declared_professor: null })).toBeNull()
  })

  it('junta cadastro e marcação do mesmo professor e conta as marcadas', () => {
    const linhas = porProfessor([
      resposta({ professor_name: 'Joseph pereira', nps_score: 10 }),
      resposta({ declared_professor: 'joseph_pereira', nps_score: 6 }),
      resposta({ declared_professor: 'unknown' }),
    ])
    expect(linhas[0]).toMatchObject({ professor: 'Joseph Pereira', respostas: 2, informadas: 1, nps: 0 })
    expect(linhas[1]).toMatchObject({ professor: 'Não identificado', identificado: false })
  })

  it('aponta aluno que marcou professor diferente do cadastro', () => {
    expect(professorDivergente({ professor_name: 'Alexandre Alves', declared_professor: 'joseph_pereira' })).toBe(true)
    expect(professorDivergente({ professor_name: 'Joseph pereira', declared_professor: 'joseph_pereira' })).toBe(false)
    expect(professorDivergente({ professor_name: 'Alexandre Alves', declared_professor: 'unknown' })).toBe(false)
    const r = montarRelatorio([resposta({ professor_name: 'Alexandre Alves', declared_professor: 'mateus_fonseca' })])
    expect(r.professoresDivergentes).toBe(1)
    expect(r.pontos.find((p) => p.id === 'professor-divergente')?.titulo).toBe('1 aluno marcou outro professor')
  })
})
