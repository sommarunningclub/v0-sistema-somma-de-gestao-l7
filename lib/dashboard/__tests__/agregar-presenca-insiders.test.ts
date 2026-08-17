import { agregarPresencaInsiders } from '../agregar-presenca-insiders'

const realizados = new Set(['e1', 'e2', 'e3'])

describe('agregarPresencaInsiders', () => {
  it('conta sommas distintos em que o insider correu ou apoiou', () => {
    const { totalEventos, insiders } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana Insider' },
        { insider_id: 'i-ana', evento_id: 'e2', status: 'apoio', nome: 'Ana Insider' },
        { insider_id: 'i-bia', evento_id: 'e1', status: 'corre', nome: 'Bia Insider' },
        { insider_id: 'i-bia', evento_id: 'e2', status: 'nao_vai', nome: 'Bia Insider' },
      ],
      realizados
    )

    expect(totalEventos).toBe(2)
    expect(insiders).toEqual([
      { id: 'i-ana', nome: 'Ana Insider', eventos: 2 },
      { id: 'i-bia', nome: 'Bia Insider', eventos: 1 },
    ])
  })

  it('não conta "não vai" como presença', () => {
    const { insiders } = agregarPresencaInsiders(
      [{ insider_id: 'i-ana', evento_id: 'e1', status: 'nao_vai', nome: 'Ana' }],
      realizados
    )

    expect(insiders).toEqual([])
  })

  it('ignora escala de somma ainda não realizado', () => {
    const { totalEventos, insiders } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e-futuro', status: 'corre', nome: 'Ana' },
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana' },
      ],
      realizados
    )

    expect(totalEventos).toBe(1)
    expect(insiders).toEqual([{ id: 'i-ana', nome: 'Ana', eventos: 1 }])
  })

  it('inclui no denominador somma com escala mesmo se todos marcaram não vai', () => {
    const { totalEventos, insiders } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'nao_vai', nome: 'Ana' },
        { insider_id: 'i-bia', evento_id: 'e2', status: 'corre', nome: 'Bia' },
      ],
      realizados
    )

    expect(totalEventos).toBe(2)
    expect(insiders).toEqual([{ id: 'i-bia', nome: 'Bia', eventos: 1 }])
  })

  it('desempata por nome em pt-BR quando a cobertura é igual', () => {
    const { insiders } = agregarPresencaInsiders(
      [
        { insider_id: 'i-bia', evento_id: 'e1', status: 'apoio', nome: 'Bia Insider' },
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: 'Ana Insider' },
      ],
      realizados
    )

    expect(insiders.map((i) => i.nome)).toEqual(['Ana Insider', 'Bia Insider'])
  })

  it('corta no décimo lugar', () => {
    const escalas = Array.from({ length: 12 }, (_, i) => ({
      insider_id: `i-${i}`,
      evento_id: 'e1',
      status: 'corre' as const,
      nome: `Insider ${String(i).padStart(2, '0')}`,
    }))

    expect(agregarPresencaInsiders(escalas, realizados).insiders).toHaveLength(10)
  })

  it('usa o último nome visto e cai para fallback se vier vazio', () => {
    const { insiders } = agregarPresencaInsiders(
      [
        { insider_id: 'i-ana', evento_id: 'e1', status: 'corre', nome: null },
        { insider_id: 'i-ana', evento_id: 'e2', status: 'apoio', nome: '  Ana  ' },
        { insider_id: 'i-sem', evento_id: 'e1', status: 'corre', nome: '   ' },
      ],
      realizados
    )

    expect(insiders).toEqual([
      { id: 'i-ana', nome: 'Ana', eventos: 2 },
      { id: 'i-sem', nome: 'Insider sem nome', eventos: 1 },
    ])
  })
})
