import { agregarPresencaInsiders } from '../agregar-presenca-insiders'

const insiders = [
  { id: 'i-ana', nome: 'Ana Insider', cpf: '529.982.247-25' },
  { id: 'i-bia', nome: 'Bia Insider', cpf: '390.533.447-05' },
  { id: 'i-caio', nome: 'Caio Insider', cpf: '11144477735' },
]

describe('agregarPresencaInsiders', () => {
  it('conta eventos distintos por CPF e devolve o top 10 ordenado', () => {
    const ranking = agregarPresencaInsiders(
      [
        { cpf: '529.982.247-25', evento_id: 'e1' },
        { cpf: '52998224725', evento_id: 'e1' },
        { cpf: '52998224725', evento_id: 'e2' },
        { cpf: '390.533.447-05', evento_id: 'e1' },
        { cpf: '00000000000', evento_id: 'e1' },
      ],
      insiders
    )

    expect(ranking).toEqual([
      { id: 'i-ana', nome: 'Ana Insider', eventos: 2 },
      { id: 'i-bia', nome: 'Bia Insider', eventos: 1 },
    ])
  })

  it('usa o nome do cadastro, não a grafia do check-in', () => {
    const ranking = agregarPresencaInsiders(
      [{ cpf: '52998224725', evento_id: 'e1' }],
      [{ id: 'i-ana', nome: 'Ana Insider', cpf: '52998224725' }]
    )

    expect(ranking[0].nome).toBe('Ana Insider')
  })

  it('casa CPF com e sem máscara nos dois lados', () => {
    const ranking = agregarPresencaInsiders(
      [{ cpf: '529.982.247-25', evento_id: 'e1' }],
      [{ id: 'i-ana', nome: 'Ana', cpf: '52998224725' }]
    )

    expect(ranking).toHaveLength(1)
    expect(ranking[0].id).toBe('i-ana')
  })

  it('ignora check-in sem CPF, sem evento ou de quem não é insider', () => {
    const ranking = agregarPresencaInsiders(
      [
        { cpf: null, evento_id: 'e1' },
        { cpf: '52998224725', evento_id: null },
        { cpf: '00000000000', evento_id: 'e1' },
      ],
      insiders
    )

    expect(ranking).toEqual([])
  })

  it('desempata por nome em pt-BR quando a cobertura é igual', () => {
    const ranking = agregarPresencaInsiders(
      [
        { cpf: '39053344705', evento_id: 'e1' },
        { cpf: '52998224725', evento_id: 'e1' },
      ],
      insiders
    )

    expect(ranking.map((i) => i.nome)).toEqual(['Ana Insider', 'Bia Insider'])
  })

  it('corta no décimo lugar', () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({
      id: `i-${i}`,
      nome: `Insider ${String(i).padStart(2, '0')}`,
      cpf: String(i).padStart(11, '0'),
    }))
    const checkins = muitos.map((insider) => ({
      cpf: insider.cpf,
      evento_id: 'e1',
    }))

    expect(agregarPresencaInsiders(checkins, muitos)).toHaveLength(10)
  })

  it('não duplica insider com o mesmo CPF em grafias diferentes', () => {
    const ranking = agregarPresencaInsiders(
      [{ cpf: '52998224725', evento_id: 'e1' }],
      [
        { id: 'i-1', nome: 'Primeiro', cpf: '529.982.247-25' },
        { id: 'i-2', nome: 'Segundo', cpf: '52998224725' },
      ]
    )

    expect(ranking).toEqual([{ id: 'i-1', nome: 'Primeiro', eventos: 1 }])
  })
})
