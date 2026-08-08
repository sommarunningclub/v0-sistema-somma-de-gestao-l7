import {
  foldText,
  matchesTextSearch,
  searchAndRank,
  toAccentInsensitiveRegex,
  toSearchTerms,
} from '../search-utils'

/**
 * A busca é o caminho mais usado do painel e falha em silêncio: quando ela
 * deixa de achar um registro, ninguém vê erro — o operador só conclui que "não
 * está cadastrado". Por isso cada comportamento tem um caso aqui.
 */

describe('foldText', () => {
  it('remove acentos e caixa', () => {
    expect(foldText('Fabrício MORAIS')).toBe('fabricio morais')
    expect(foldText('JOSÉ DA CONCEIÇÃO')).toBe('jose da conceicao')
    expect(foldText('Ângela Nuñez')).toBe('angela nunez')
  })

  it('tolera nulo e vazio', () => {
    expect(foldText(null)).toBe('')
    expect(foldText(undefined)).toBe('')
  })
})

describe('matchesTextSearch — acentuação', () => {
  it('acha nome acentuado digitando sem acento', () => {
    expect(matchesTextSearch('fabricio', ['Fabrício Morais'])).toBe(true)
    expect(matchesTextSearch('conceicao', ['José da Conceição'])).toBe(true)
  })

  it('acha nome sem acento digitando com acento', () => {
    expect(matchesTextSearch('JOSÉ', ['jose alves'])).toBe(true)
  })

  it('ignora a caixa', () => {
    expect(matchesTextSearch('ANA', ['ana paula'])).toBe(true)
  })
})

describe('matchesTextSearch — ordem das palavras', () => {
  it('acha com os termos fora de ordem', () => {
    expect(matchesTextSearch('silva maria', ['Maria da Silva'])).toBe(true)
  })

  it('exige que TODOS os termos apareçam', () => {
    expect(matchesTextSearch('maria pereira', ['Maria da Silva'])).toBe(false)
  })

  it('casa termos espalhados por campos diferentes', () => {
    expect(matchesTextSearch('maria gmail', ['Maria Silva', 'maria@gmail.com'])).toBe(true)
  })
})

describe('matchesTextSearch — documentos e telefones', () => {
  it('acha CPF formatado digitando só os números', () => {
    expect(matchesTextSearch('05326833743', ['053.268.337-43'])).toBe(true)
  })

  it('acha CPF sem formatação digitando com pontuação', () => {
    expect(matchesTextSearch('053.268.337-43', ['05326833743'])).toBe(true)
  })

  it('acha telefone pelo trecho que a pessoa digita, ignorando a formatação', () => {
    // Campo "(61) 99996-8034" vira "61999968034"; DDD + começo do número.
    expect(matchesTextSearch('6199996', ['(61) 99996-8034'])).toBe(true)
    expect(matchesTextSearch('99996', ['(61) 99996-8034'])).toBe(true)
    expect(matchesTextSearch('(61) 9999', ['61999968034'])).toBe(true)
  })

  it('um único dígito ainda filtra por substring, como esperado ao digitar', () => {
    expect(matchesTextSearch('6', ['(61) 99996-8034'])).toBe(true)
  })

  it('não casa sequência de dígitos que o registro não tem', () => {
    expect(matchesTextSearch('7777', ['(61) 99996-8034'])).toBe(false)
  })
})

describe('matchesTextSearch — erro de digitação', () => {
  it('tolera uma letra faltando', () => {
    expect(matchesTextSearch('rodriges', ['Alex Rodrigues dos Santos'])).toBe(true)
  })

  it('tolera letras trocadas de posição', () => {
    expect(matchesTextSearch('rodrigeus', ['Alex Rodrigues dos Santos'])).toBe(true)
  })

  it('não tolera erro em termo curto — evitaria ruído', () => {
    expect(matchesTextSearch('xyz', ['Ana Paula'])).toBe(false)
  })

  it('continua rejeitando quem não tem nada a ver', () => {
    expect(matchesTextSearch('bicicleta', ['Alex Rodrigues dos Santos'])).toBe(false)
  })
})

describe('matchesTextSearch — casos de borda', () => {
  it('busca vazia devolve tudo', () => {
    expect(matchesTextSearch('', ['qualquer'])).toBe(true)
    expect(matchesTextSearch('   ', ['qualquer'])).toBe(true)
  })

  it('registro sem nenhum campo preenchido não casa', () => {
    expect(matchesTextSearch('ana', [null, undefined, ''])).toBe(false)
  })
})

describe('searchAndRank', () => {
  const pessoas = [
    { nome: 'Mariana Fernandes', cpf: '111.111.111-11' },
    { nome: 'Ana Paula Souza', cpf: '222.222.222-22' },
    { nome: 'Adriano Gustavo', cpf: '333.333.333-33' },
  ]
  const campos = (p: (typeof pessoas)[number]) => [p.nome, p.cpf]

  it('coloca o começo do nome antes do meio da palavra', () => {
    const r = searchAndRank(pessoas, 'ana', campos)
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].nome).toBe('Ana Paula Souza')
  })

  it('devolve a lista intacta quando não há busca', () => {
    expect(searchAndRank(pessoas, '', campos)).toHaveLength(3)
  })

  it('põe o CPF exato no topo', () => {
    const r = searchAndRank(pessoas, '33333333333', campos)
    expect(r[0].nome).toBe('Adriano Gustavo')
  })

  it('não devolve quem não casa', () => {
    expect(searchAndRank(pessoas, 'bicicleta', campos)).toHaveLength(0)
  })

  it('aguenta lista vazia', () => {
    expect(searchAndRank([], 'ana', campos)).toHaveLength(0)
  })
})

describe('toAccentInsensitiveRegex — busca no servidor', () => {
  it('expande vogais para aceitar acentos', () => {
    expect(toAccentInsensitiveRegex('jose')).toBe('j[oóòôõö]s[eéèêë]')
  })

  it('expande cedilha e til de n', () => {
    expect(toAccentInsensitiveRegex('conceicao')).toContain('[cç]')
    expect(toAccentInsensitiveRegex('nunez')).toContain('[nñ]')
  })

  it('escapa metacaracteres para não quebrar a consulta', () => {
    const r = toAccentInsensitiveRegex('a.b*c')
    expect(r).toContain('\\.')
    expect(r).toContain('\\*')
  })

  it('não deixa passar injeção de regex', () => {
    expect(toAccentInsensitiveRegex('(a|b)')).toContain('\\(')
    expect(toAccentInsensitiveRegex('(a|b)')).toContain('\\|')
  })
})

describe('toSearchTerms', () => {
  it('quebra em termos e descarta espaços extras', () => {
    expect(toSearchTerms('  maria   silva ')).toEqual(['maria', 'silva'])
  })

  it('devolve vazio para busca em branco', () => {
    expect(toSearchTerms('   ')).toEqual([])
  })
})
