import { idadeDeNascimento, InsiderWriteError, prepareInsiderWrite } from '../admin-write'

describe('idadeDeNascimento', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 7, 17))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('calcula anos completos a partir de YYYY-MM-DD', () => {
    expect(idadeDeNascimento('1990-03-15')).toBe(36)
  })

  it('ainda não fez aniversário neste ano', () => {
    expect(idadeDeNascimento('1990-08-18')).toBe(35)
  })

  it('devolve null para valor vazio ou malformado', () => {
    expect(idadeDeNascimento(null)).toBeNull()
    expect(idadeDeNascimento('15/03/1990')).toBeNull()
  })
})

describe('prepareInsiderWrite', () => {
  it('converte data brasileira para ISO e ativo para boolean', () => {
    expect(
      prepareInsiderWrite({
        nome: 'Ana',
        data_nascimento: '15/03/1990',
        ativo: true,
        consent_lgpd: true,
        id: 'nao-pode',
      })
    ).toEqual({
      nome: 'Ana',
      data_nascimento: '1990-03-15',
      ativo: true,
    })
  })

  it('grava null quando a data vem vazia', () => {
    expect(prepareInsiderWrite({ data_nascimento: '' })).toEqual({ data_nascimento: null })
  })

  it('preserva data já em ISO', () => {
    expect(prepareInsiderWrite({ data_nascimento: '1990-03-15' })).toEqual({
      data_nascimento: '1990-03-15',
    })
  })

  it('rejeita data malformada', () => {
    expect(() => prepareInsiderWrite({ data_nascimento: '15/03/90' })).toThrow(InsiderWriteError)
  })

  it('não deixa gravar consentimento nem id', () => {
    const fields = prepareInsiderWrite({
      evolve: 'VIP',
      consent_lgpd: true,
      consent_imagem: true,
      id: 'abc',
    })
    expect(fields).toEqual({ evolve: 'VIP' })
  })
})
