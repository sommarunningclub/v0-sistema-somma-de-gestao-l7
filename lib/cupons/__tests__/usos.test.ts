import { descreverAbatimento, descreverCobranca, situacaoDoUso } from '../usos'

// A lista de usos é o que o time olha para responder "quem usou o cupom e o
// que aconteceu com a compra". Um rótulo errado aqui vira cobrança errada
// discutida com o cliente.

describe('descreverCobranca', () => {
  it('junta plano e forma de cobrança', () => {
    expect(descreverCobranca({ plano: 'Mensal', billing: 'recurring' })).toBe('Mensal · Mensal no cartão')
    expect(descreverCobranca({ plano: 'Anual', billing: 'pix' })).toBe('Anual · PIX à vista')
  })

  it('mostra o que tiver quando o histórico veio incompleto', () => {
    expect(descreverCobranca({ plano: 'Semestral', billing: null })).toBe('Semestral')
    expect(descreverCobranca({ plano: null, billing: 'installment' })).toBe('Parcelado no cartão')
    expect(descreverCobranca({ plano: null, billing: null })).toBe('-')
  })
})

describe('descreverAbatimento', () => {
  it('formata em reais', () => {
    // O Intl usa espaço não separável entre "R$" e o número.
    expect(descreverAbatimento({ discount_applied: 70 })?.replace(/\u00a0/g, ' ')).toBe('R$ 70,00 de desconto')
  })

  it('omite quando a importação não soube o desconto', () => {
    expect(descreverAbatimento({ discount_applied: null })).toBeNull()
    expect(descreverAbatimento({ discount_applied: 0 })).toBeNull()
  })
})

describe('situacaoDoUso', () => {
  it('uso gravado pelo checkout não tem status do Asaas', () => {
    expect(situacaoDoUso({ asaas_status: null })).toBeNull()
  })

  it('estorno continua contando como uso, mas avisa', () => {
    expect(situacaoDoUso({ asaas_status: 'REFUNDED' })).toEqual({ rotulo: 'Estornado', tone: 'warning' })
    expect(situacaoDoUso({ asaas_status: 'ACTIVE' })).toEqual({ rotulo: 'Pago', tone: 'success' })
  })
})
