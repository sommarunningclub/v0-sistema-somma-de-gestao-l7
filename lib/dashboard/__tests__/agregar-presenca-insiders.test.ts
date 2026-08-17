import { agregarPresencaInsiders, chaveMes } from '../agregar-presenca-insiders'

const cadastro = [
  { id: 'i-ana', nome: 'Ana Insider' },
  { id: 'i-bia', nome: 'Bia Insider' },
  { id: 'i-caio', nome: 'Caio Insider' },
]

const eventos = [
  { id: 'e1', data_evento: '2026-08-08' },
  { id: 'e2', data_evento: '2026-08-16' },
  { id: 'e3', data_evento: '2026-07-12' },
]

describe('chaveMes', () => {
  it('extrai YYYY-MM de uma data de evento', () => {
    expect(chaveMes('2026-08-16')).toBe('2026-08')
  })

  it('rejeita valor malformado', () => {
    expect(chaveMes('agosto')).toBeNull()
  })
})

describe('agregarPresencaInsiders', () => {
  it('lista o cadastro inteiro, com zero para quem não esteve presente', () => {
    const { todos, meses } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana Insider' },
        { insider_id: 'i-ana', evento_id: 'e2', status: 'apoio', nome: 'Ana Insider' },
        { insider_id: 'i-bia', evento_id: 'e1', status: 'corre', nome: 'Bia Insider' },
        { insider_id: 'i-bia', evento_id: 'e2', status: 'nao_vai', nome: 'Bia Insider' },
      ],
      eventos,
      cadastro
    )

    expect(todos.totalEventos).toBe(2)
    expect(todos.insiders).toEqual([
      { id: 'i-ana', nome: 'Ana Insider', eventos: 2 },
      { id: 'i-bia', nome: 'Bia Insider', eventos: 1 },
      { id: 'i-caio', nome: 'Caio Insider', eventos: 0 },
    ])
    expect(meses).toHaveLength(1)
    expect(meses[0].mes).toBe('2026-08')
    expect(meses[0].totalEventos).toBe(2)
  })

  it('não conta "não vai" como presença, mas mantém o insider no ranking', () => {
    const { todos } = agregarPresencaInsiders(
      [{ insider_id: 'i-ana', evento_id: 'e1', status: 'nao_vai', nome: 'Ana' }],
      eventos,
      [{ id: 'i-ana', nome: 'Ana' }]
    )

    expect(todos.totalEventos).toBe(1)
    expect(todos.insiders).toEqual([{ id: 'i-ana', nome: 'Ana', eventos: 0 }])
  })

  it('separa a presença por mês e ignora somma que ainda não foi realizado', () => {
    const { meses, todos } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana' },
        { insider_id: 'i-ana', evento_id: 'e3', status: 'apoio', nome: 'Ana' },
        { insider_id: 'i-bia', evento_id: 'e3', status: 'corre', nome: 'Bia' },
        { insider_id: 'i-ana', evento_id: 'e-futuro', status: 'corre', nome: 'Ana' },
      ],
      eventos,
      cadastro
    )

    expect(todos.insiders.find((i) => i.id === 'i-ana')?.eventos).toBe(2)

    const agosto = meses.find((m) => m.mes === '2026-08')
    const julho = meses.find((m) => m.mes === '2026-07')
    expect(agosto?.totalEventos).toBe(1)
    expect(agosto?.insiders.find((i) => i.id === 'i-ana')?.eventos).toBe(1)
    expect(agosto?.insiders.find((i) => i.id === 'i-bia')?.eventos).toBe(0)
    expect(julho?.totalEventos).toBe(1)
    expect(julho?.insiders.find((i) => i.id === 'i-bia')?.eventos).toBe(1)
  })

  it('ordena os meses do mais recente para o mais antigo', () => {
    const { meses } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana' },
        { insider_id: 'i-ana', evento_id: 'e3', status: 'corre', nome: 'Ana' },
      ],
      eventos,
      cadastro
    )

    expect(meses.map((m) => m.mes)).toEqual(['2026-08', '2026-07'])
  })

  it('desempata por nome em pt-BR quando a cobertura é igual', () => {
    const { todos } = agregarPresencaInsiders(
      [
        { insider_id: 'i-bia', evento_id: 'e1', status: 'apoio', nome: 'Bia Insider' },
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana Insider' },
      ],
      eventos,
      [
        { id: 'i-bia', nome: 'Bia Insider' },
        { id: 'i-ana', nome: 'Ana Insider' },
      ]
    )

    expect(todos.insiders.map((i) => i.nome)).toEqual(['Ana Insider', 'Bia Insider'])
  })

  it('não corta a lista: zero também entra', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({
      id: `i-${i}`,
      nome: `Insider ${String(i).padStart(2, '0')}`,
    }))
    const escalas = muitos.slice(0, 3).map((insider) => ({
      insider_id: insider.id,
      evento_id: 'e1',
      status: 'corre' as const,
      nome: insider.nome,
    }))

    expect(agregarPresencaInsiders(escalas, eventos, muitos).todos.insiders).toHaveLength(12)
    expect(
      agregarPresencaInsiders(escalas, eventos, muitos).todos.insiders.filter((i) => i.eventos === 0)
    ).toHaveLength(9)
  })

  it('privilegia o nome do cadastro e cai para fallback se vier vazio', () => {
    const { todos } = agregarPresencaInsiders(
      [{ insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Grafia da escala' }],
      eventos,
      [
        { id: 'i-ana', nome: 'Ana' },
        { id: 'i-sem', nome: '   ' },
      ]
    )

    expect(todos.insiders).toEqual([
      { id: 'i-ana', nome: 'Ana', eventos: 1 },
      { id: 'i-sem', nome: 'Insider sem nome', eventos: 0 },
    ])
  })
})
