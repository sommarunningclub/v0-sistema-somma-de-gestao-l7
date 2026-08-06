import {
  resumirPelotoes,
  estadoDoDia,
  validarEscalacao,
  buildMonthGrid,
} from '@/lib/escala-rules'
import { META_POR_PELOTAO } from '@/lib/escala-constants'

const PELOTOES = ['4km', '6km', '8km']

describe('resumirPelotoes', () => {
  it('conta só quem tem status corre, por pelotão', () => {
    const resumo = resumirPelotoes(PELOTOES, [
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '6km' },
      { status: 'apoio', pelotao: null },
      { status: 'nao_vai', pelotao: null },
    ])

    expect(resumo).toEqual([
      { pelotao: '4km', escalados: 2, meta: META_POR_PELOTAO, estado: 'completo' },
      { pelotao: '6km', escalados: 1, meta: META_POR_PELOTAO, estado: 'parcial' },
      { pelotao: '8km', escalados: 0, meta: META_POR_PELOTAO, estado: 'vazio' },
    ])
  })

  it('marca completo quando passa da meta', () => {
    const resumo = resumirPelotoes(['4km'], [
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
      { status: 'corre', pelotao: '4km' },
    ])
    expect(resumo[0]).toEqual({ pelotao: '4km', escalados: 3, meta: META_POR_PELOTAO, estado: 'completo' })
  })

  it('ignora corredor com pelotão que não é do evento', () => {
    const resumo = resumirPelotoes(['4km'], [{ status: 'corre', pelotao: '10km' }])
    expect(resumo[0].escalados).toBe(0)
  })
})

describe('estadoDoDia', () => {
  const resumo = (escalados: number[]) =>
    resumirPelotoes(
      PELOTOES,
      escalados.flatMap((n, i) =>
        Array.from({ length: n }, () => ({ status: 'corre' as const, pelotao: PELOTOES[i] }))
      )
    )

  it('é completo quando todo pelotão bate a meta', () => {
    expect(estadoDoDia(resumo([2, 2, 2]))).toBe('completo')
  })

  it('é parcial quando falta alguém', () => {
    expect(estadoDoDia(resumo([2, 1, 0]))).toBe('parcial')
  })

  it('é vazio quando ninguém foi escalado', () => {
    expect(estadoDoDia(resumo([0, 0, 0]))).toBe('vazio')
  })

  it('é vazio quando o evento não tem pelotões', () => {
    expect(estadoDoDia([])).toBe('vazio')
  })

  it('é completo quando não há pelotões mas há gente no apoio', () => {
    expect(estadoDoDia([], 3)).toBe('completo')
  })

  it('é vazio quando não há pelotões e ninguém no apoio', () => {
    expect(estadoDoDia([], 0)).toBe('vazio')
    expect(estadoDoDia([])).toBe('vazio')
  })
})

describe('validarEscalacao', () => {
  it('aceita corre com pelotão do evento', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre', pelotao: '6km' }, PELOTOES)).toBeNull()
  })

  it('recusa corre sem pelotão', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre' }, PELOTOES))
      .toBe('Selecione o pelotão de quem vai correr')
  })

  it('recusa pelotão que não é do evento', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'corre', pelotao: '10km' }, PELOTOES))
      .toBe('Pelotão "10km" não existe neste evento')
  })

  it('recusa nao_vai sem motivo', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'nao_vai', motivo: '  ' }, PELOTOES))
      .toBe('Informe o motivo da ausência')
  })

  it('recusa nao_vai com atividade', () => {
    expect(validarEscalacao(
      { insider_id: 'i1', status: 'nao_vai', motivo: 'Viagem', atividade_ids: ['a1'] },
      PELOTOES
    )).toBe('Quem não vai não pode ter atividades')
  })

  it('aceita apoio com atividades e sem pelotão', () => {
    expect(validarEscalacao(
      { insider_id: 'i1', status: 'apoio', atividade_ids: ['a1', 'a2'] },
      PELOTOES
    )).toBeNull()
  })

  it('recusa insider_id vazio', () => {
    expect(validarEscalacao({ insider_id: '', status: 'apoio' }, PELOTOES))
      .toBe('Selecione o insider')
  })

  it('recusa status inválido', () => {
    expect(validarEscalacao({ insider_id: 'i1', status: 'correndo' as never }, PELOTOES))
      .toBe('Status inválido')
  })
})

describe('buildMonthGrid', () => {
  it('monta 42 células começando no domingo anterior', () => {
    const grid = buildMonthGrid(2026, 8)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toEqual({ data: '2026-07-26', dia: 26, no_mes: false })
    expect(grid[41].data).toBe('2026-09-05')
  })

  it('marca no_mes só para os dias do mês pedido', () => {
    const grid = buildMonthGrid(2026, 8)
    expect(grid.filter(c => c.no_mes)).toHaveLength(31)
    expect(grid.find(c => c.data === '2026-08-01')).toEqual({ data: '2026-08-01', dia: 1, no_mes: true })
  })
})
