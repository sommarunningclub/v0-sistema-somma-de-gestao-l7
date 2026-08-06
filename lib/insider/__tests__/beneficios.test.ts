import { montarBeneficios, BENEFICIO_COLUNAS } from '../beneficios'

const linhaReal = {
  evolve: 'Ativo - POSSUI SALDO DEVEDOR , SENDO NECESSÁRIO O CANCELAMENTO NA UNIDADE. FEITO ISSO É LANÇADO A BOLSA',
  dopahmina: '0.1',
  tex_barbearia: 'Insiders: 10% de desconto em 1 serviço, 2 serviços ou mais: 15% de desconto',
  cupom_loja_somma: 'INSIDERES27',
  big_box: 'BIGSOMMA',
  assessoria_somma: 'Sim',
  estamina_recovery: 'Voucher de 150 reais',
}

const buscar = (linha: Record<string, unknown>, chave: string) =>
  montarBeneficios(linha).find((b) => b.chave === chave)!

describe('montarBeneficios — Evolve', () => {
  it('mostra apenas Ativo, descartando a anotação interna', () => {
    const b = buscar(linhaReal, 'evolve')
    expect(b.valor).toBe('Ativo')
    expect(b.tipo).toBe('status')
    expect(b.disponivel).toBe(true)
  })

  it('mostra Inativo quando o texto não começa com "ativo"', () => {
    expect(buscar({ ...linhaReal, evolve: 'Cancelado' }, 'evolve').valor).toBe('Inativo')
    expect(buscar({ ...linhaReal, evolve: '' }, 'evolve').valor).toBe('Inativo')
  })

  it('aceita variações de caixa e espaço', () => {
    expect(buscar({ ...linhaReal, evolve: '  ATIVO  ' }, 'evolve').valor).toBe('Ativo')
  })
})

describe('montarBeneficios — não vaza anotação interna', () => {
  it('nenhum valor de saída contém termos administrativos', () => {
    const proibidos = ['SALDO DEVEDOR', 'CANCELAMENTO', 'BOLSA', 'UNIDADE']
    const saida = JSON.stringify(montarBeneficios(linhaReal)).toUpperCase()
    for (const termo of proibidos) {
      expect(saida).not.toContain(termo)
    }
  })
})

describe('montarBeneficios — Dopamina', () => {
  it('converte 0.1 em 10% de desconto', () => {
    expect(buscar(linhaReal, 'dopahmina').valor).toBe('10% de desconto')
  })

  it('converte 0.15 em 15% de desconto', () => {
    expect(buscar({ ...linhaReal, dopahmina: '0.15' }, 'dopahmina').valor).toBe('15% de desconto')
  })

  it('fica indisponível quando não é número', () => {
    expect(buscar({ ...linhaReal, dopahmina: 'abc' }, 'dopahmina').disponivel).toBe(false)
    expect(buscar({ ...linhaReal, dopahmina: '' }, 'dopahmina').disponivel).toBe(false)
  })
})

describe('montarBeneficios — cupons e descrições', () => {
  it('devolve o cupom individual da Loja Somma', () => {
    const b = buscar(linhaReal, 'cupom_loja_somma')
    expect(b.valor).toBe('INSIDERES27')
    expect(b.tipo).toBe('cupom')
  })

  it('devolve o cupom do Big Box', () => {
    expect(buscar(linhaReal, 'big_box').valor).toBe('BIGSOMMA')
  })

  it('devolve as descrições como estão', () => {
    expect(buscar(linhaReal, 'tex_barbearia').valor).toContain('10% de desconto')
    expect(buscar(linhaReal, 'estamina_recovery').valor).toBe('Voucher de 150 reais')
  })

  it('marca cupom e descrição vazios como indisponíveis', () => {
    const vazio = { ...linhaReal, cupom_loja_somma: '', estamina_recovery: null }
    expect(buscar(vazio, 'cupom_loja_somma').disponivel).toBe(false)
    expect(buscar(vazio, 'estamina_recovery').disponivel).toBe(false)
  })
})

describe('montarBeneficios — Assessoria Somma', () => {
  it('mostra Ativo quando o valor é Sim', () => {
    expect(buscar(linhaReal, 'assessoria_somma').valor).toBe('Ativo')
  })

  it('mostra Não incluído quando vazio, e segue disponível para exibição', () => {
    const b = buscar({ ...linhaReal, assessoria_somma: '' }, 'assessoria_somma')
    expect(b.valor).toBe('Não incluído')
    expect(b.disponivel).toBe(true)
  })
})

describe('montarBeneficios — estrutura', () => {
  it('devolve os sete benefícios, sempre na mesma ordem', () => {
    const chaves = montarBeneficios(linhaReal).map((b) => b.chave)
    expect(chaves).toEqual([
      'evolve',
      'dopahmina',
      'tex_barbearia',
      'cupom_loja_somma',
      'big_box',
      'assessoria_somma',
      'estamina_recovery',
    ])
  })

  it('todo benefício tem rótulo legível', () => {
    for (const b of montarBeneficios(linhaReal)) {
      expect(b.rotulo.length).toBeGreaterThan(2)
    }
  })

  it('BENEFICIO_COLUNAS lista as sete colunas e nada de senha', () => {
    for (const c of ['evolve', 'dopahmina', 'tex_barbearia', 'cupom_loja_somma', 'big_box', 'assessoria_somma', 'estamina_recovery']) {
      expect(BENEFICIO_COLUNAS).toContain(c)
    }
    expect(BENEFICIO_COLUNAS).not.toContain('senha')
  })
})
