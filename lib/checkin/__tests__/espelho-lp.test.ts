import { foraDaLista, soDigitos } from '../espelho-lp'

describe('soDigitos', () => {
  it('tira a máscara do CPF', () => {
    expect(soDigitos('123.456.789-01')).toBe('12345678901')
    expect(soDigitos(null)).toBe('')
  })
})

describe('foraDaLista', () => {
  const parts = [
    { id: 'a', cpf: '12345678901' },
    { id: 'b', cpf: '98765432100' },
    { id: 'c', cpf: '11122233344' },
  ]

  it('ignora quem já está na lista, em qualquer grafia do CPF', () => {
    const fora = foraDaLista(parts, ['123.456.789-01', '11122233344'])
    expect(fora.map(p => p.id)).toEqual(['b'])
  })

  it('devolve todos quando a lista está vazia', () => {
    expect(foraDaLista(parts, []).map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('não repete o mesmo CPF entre os participantes', () => {
    const fora = foraDaLista([...parts, { id: 'd', cpf: '987.654.321-00' }], [])
    expect(fora.map(p => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('descarta participante sem CPF', () => {
    expect(foraDaLista([{ id: 'x', cpf: '' }], [])).toEqual([])
  })
})
