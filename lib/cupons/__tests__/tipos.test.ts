import {
  descreverDesconto,
  descreverRegras,
  normalizarCodigo,
  situacaoDoCupom,
  validarEntrada,
  type Cupom,
} from '../tipos'

// O que esta validação barra não é erro de digitação: é desconto aplicado em
// cobrança real no Asaas. Cada caso abaixo é um jeito de cobrar errado.

const base = {
  code: 'BLACKFRIDAY',
  type: 'PERCENTAGE',
  value: 10,
  description: 'Campanha de novembro',
  expiration_date: null,
  usage_limit: null,
  professor: null,
  plan_type: null,
  first_month_only: false,
  status: 'ACTIVE',
}

function cupom(parcial: Partial<Cupom> = {}): Cupom {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'BLACKFRIDAY',
    type: 'PERCENTAGE',
    value: 10,
    description: null,
    expiration_date: null,
    usage_limit: null,
    usage_count: 0,
    status: 'ACTIVE',
    professor: null,
    plan_type: null,
    first_month_only: false,
    pix_automatico: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...parcial,
  }
}

describe('normalizarCodigo', () => {
  it('sobe para maiúsculas e tira espaços', () => {
    // O checkout procura pelo código exato; " promo 10 " nunca acharia nada.
    expect(normalizarCodigo(' promo 10 ')).toBe('PROMO10')
  })

  it('devolve string vazia para valor ausente', () => {
    expect(normalizarCodigo(null)).toBe('')
    expect(normalizarCodigo(undefined)).toBe('')
  })
})

describe('validarEntrada', () => {
  it('aceita um cupom simples', () => {
    const r = validarEntrada(base)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.code).toBe('BLACKFRIDAY')
  })

  it('normaliza o código antes de gravar', () => {
    const r = validarEntrada({ ...base, code: ' promo10 ' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.code).toBe('PROMO10')
  })

  it('recusa código fora do formato', () => {
    expect(validarEntrada({ ...base, code: 'AB' }).ok).toBe(false)
    expect(validarEntrada({ ...base, code: 'PROMO@10' }).ok).toBe(false)
    expect(validarEntrada({ ...base, code: '' }).ok).toBe(false)
  })

  it('recusa percentual acima de 100', () => {
    // 120% viraria desconto maior que a mensalidade.
    const r = validarEntrada({ ...base, value: 120 })
    expect(r.ok).toBe(false)
  })

  it('aceita 100% e desconto fixo alto', () => {
    expect(validarEntrada({ ...base, value: 100 }).ok).toBe(true)
    expect(validarEntrada({ ...base, type: 'FIXED', value: 500 }).ok).toBe(true)
  })

  it('recusa valor zerado ou negativo', () => {
    expect(validarEntrada({ ...base, value: 0 }).ok).toBe(false)
    expect(validarEntrada({ ...base, value: -10 }).ok).toBe(false)
  })

  it('arredonda o valor em duas casas', () => {
    const r = validarEntrada({ ...base, type: 'FIXED', value: 10.129 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.value).toBe(10.13)
  })

  it('recusa professor que o checkout não reconhece', () => {
    // O site compara o nome por igualdade exata: "Joseph" nunca casaria com
    // "Joseph Pereira" e o cupom simplesmente não funcionaria.
    expect(validarEntrada({ ...base, professor: 'Joseph' }).ok).toBe(false)
    expect(validarEntrada({ ...base, professor: 'Joseph Pereira' }).ok).toBe(true)
  })

  it('recusa 1ª mensalidade em plano parcelado', () => {
    // Combinação que a tela prometeria e a cobrança ignoraria.
    const r = validarEntrada({ ...base, first_month_only: true, plan_type: 'installment' })
    expect(r.ok).toBe(false)
  })

  it('aceita 1ª mensalidade em plano recorrente ou sem restrição', () => {
    expect(validarEntrada({ ...base, first_month_only: true, plan_type: 'recurring' }).ok).toBe(true)
    expect(validarEntrada({ ...base, first_month_only: true, plan_type: null }).ok).toBe(true)
  })

  it('recusa Pix Automático em cupom de plano parcelado', () => {
    // Pix Automático é débito mensal: não existe no Semestral/Anual, e a
    // combinação seria uma regra que nunca casa com nada.
    const r = validarEntrada({ ...base, pix_automatico: true, plan_type: 'installment' })
    expect(r.ok).toBe(false)
  })

  it('aceita Pix Automático no mensal ou sem restrição de plano', () => {
    expect(validarEntrada({ ...base, pix_automatico: true, plan_type: 'recurring' }).ok).toBe(true)
    expect(validarEntrada({ ...base, pix_automatico: true, plan_type: null }).ok).toBe(true)
  })

  it('não marca Pix Automático por omissão', () => {
    // O padrão continua sendo cartão: um cupom antigo não pode começar a
    // descontar débito recorrente sozinho.
    const r = validarEntrada(base)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.pix_automatico).toBe(false)
  })

  it('recusa tipo de plano desconhecido', () => {
    expect(validarEntrada({ ...base, plan_type: 'mensal' }).ok).toBe(false)
  })

  it('recusa limite de uso fracionado ou menor que 1', () => {
    expect(validarEntrada({ ...base, usage_limit: 0 }).ok).toBe(false)
    expect(validarEntrada({ ...base, usage_limit: 2.5 }).ok).toBe(false)
    expect(validarEntrada({ ...base, usage_limit: 50 }).ok).toBe(true)
  })

  it('trata limite vazio como sem limite', () => {
    const r = validarEntrada({ ...base, usage_limit: '' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.usage_limit).toBeNull()
  })

  it('recusa data de validade inválida', () => {
    expect(validarEntrada({ ...base, expiration_date: '31/12/2026' }).ok).toBe(false)
    expect(validarEntrada({ ...base, expiration_date: '2026-13-45' }).ok).toBe(false)
    expect(validarEntrada({ ...base, expiration_date: '2026-12-31' }).ok).toBe(true)
  })

  it('só aceita ACTIVE ou DISABLED como status', () => {
    // EXPIRED é derivado da validade — gravar isso na mão deixaria o cupom
    // num estado que a tela não sabe reverter.
    const r = validarEntrada({ ...base, status: 'EXPIRED' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.entrada.status).toBe('ACTIVE')
  })

  it('recusa corpo que não é objeto', () => {
    expect(validarEntrada(null).ok).toBe(false)
    expect(validarEntrada('BLACKFRIDAY').ok).toBe(false)
  })
})

describe('situacaoDoCupom', () => {
  it('mostra expirado quando a validade já passou, mesmo com status ACTIVE', () => {
    // O banco só troca o status quando alguém tenta usar; até lá a tela
    // mentiria dizendo "ativo" para um cupom que o checkout recusa.
    const s = situacaoDoCupom(cupom({ expiration_date: '2020-01-01' }))
    expect(s.estado).toBe('expirado')
  })

  it('mantém ativo até o fim do dia da validade', () => {
    const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    expect(situacaoDoCupom(cupom({ expiration_date: amanha })).estado).toBe('ativo')
  })

  it('mostra esgotado quando o limite foi atingido', () => {
    expect(situacaoDoCupom(cupom({ usage_limit: 10, usage_count: 10 })).estado).toBe('esgotado')
    expect(situacaoDoCupom(cupom({ usage_limit: 10, usage_count: 9 })).estado).toBe('ativo')
  })

  it('desativado tem precedência sobre o resto', () => {
    expect(situacaoDoCupom(cupom({ status: 'DISABLED', usage_limit: 10, usage_count: 10 })).estado)
      .toBe('desativado')
  })
})

describe('descreverDesconto', () => {
  it('formata percentual e reais', () => {
    expect(descreverDesconto({ type: 'PERCENTAGE', value: 20 })).toBe('20% de desconto')
    expect(descreverDesconto({ type: 'FIXED', value: 70 })).toBe('R$ 70,00 de desconto')
  })
})

describe('descreverRegras', () => {
  it('lista só as restrições que existem', () => {
    expect(descreverRegras(cupom())).toEqual([])
  })

  it('descreve as restrições do cupom', () => {
    const regras = descreverRegras(
      cupom({
        professor: 'Joseph Pereira',
        plan_type: 'recurring',
        first_month_only: true,
        pix_automatico: true,
        usage_limit: 50,
        usage_count: 3,
        expiration_date: '2026-12-31',
      })
    )
    expect(regras).toEqual([
      'Só com Joseph Pereira',
      'Só no plano Mensal',
      'Só na 1ª mensalidade',
      'Vale no Pix Automático',
      '3/50 usos',
      'Até 31/12/2026',
    ])
  })
})
