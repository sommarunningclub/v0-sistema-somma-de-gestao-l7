import {
  CODIGO_TAMANHO,
  CODIGO_TTL_MS,
  expiraEm,
  formatoValido,
  gerarCodigo,
  mascararEmail,
  normalizarCodigo,
} from '../login-code'

describe('gerarCodigo', () => {
  it('sempre devolve 6 dígitos, inclusive com zeros à esquerda', () => {
    for (let i = 0; i < 500; i++) {
      const codigo = gerarCodigo()
      expect(codigo).toHaveLength(CODIGO_TAMANHO)
      expect(codigo).toMatch(/^\d{6}$/)
    }
  })

  it('não repete de forma óbvia', () => {
    const vistos = new Set(Array.from({ length: 200 }, () => gerarCodigo()))
    // 200 sorteios em 1e6 possibilidades: colisão é rara, mas não impossível.
    expect(vistos.size).toBeGreaterThan(190)
  })
})

describe('normalizarCodigo', () => {
  it('descarta o que não for dígito', () => {
    expect(normalizarCodigo('123 456')).toBe('123456')
    expect(normalizarCodigo('123-456')).toBe('123456')
  })

  it('devolve string vazia para tipo errado', () => {
    expect(normalizarCodigo(null)).toBe('')
    expect(normalizarCodigo(123456)).toBe('')
  })
})

describe('formatoValido', () => {
  it('aceita exatamente 6 dígitos', () => {
    expect(formatoValido('000000')).toBe(true)
    expect(formatoValido('12345')).toBe(false)
    expect(formatoValido('1234567')).toBe(false)
    expect(formatoValido('')).toBe(false)
  })
})

describe('expiraEm', () => {
  it('soma o TTL ao instante informado', () => {
    const agora = 1_700_000_000_000
    expect(expiraEm(agora).getTime()).toBe(agora + CODIGO_TTL_MS)
  })
})

describe('mascararEmail', () => {
  it('mantém domínio e primeira letra', () => {
    expect(mascararEmail('alexandre@gmail.com')).toBe('a********@gmail.com')
  })

  it('não vaza usuário de uma letra', () => {
    expect(mascararEmail('a@gmail.com')).toBe('*@gmail.com')
  })

  it('degrada sem quebrar em entrada malformada', () => {
    expect(mascararEmail('sem-arroba')).toBe('***')
    expect(mascararEmail('@dominio.com')).toBe('***')
  })

  it('usa o último @ para não se perder com endereço estranho', () => {
    expect(mascararEmail('a"b"@c@gmail.com')).toBe('a*****@gmail.com')
  })
})
