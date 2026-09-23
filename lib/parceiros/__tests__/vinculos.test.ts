import {
  chaveContagem,
  codigoValido,
  contarInscricoes,
  eventoAberto,
  montarLink,
  normalizarCodigo,
  normalizarEventoIds,
  temPaginaDeInscricao,
} from '../vinculos'

// O que se testa aqui vira link publicado por terceiros e número de comissão:
// um link errado é um parceiro divulgando URL quebrada, e uma contagem errada
// é crédito indo para o parceiro errado.

const somma = {
  id: '03e8da77-b090-460c-8666-6d55311c9867',
  titulo: 'SOMMA DAY',
  data_evento: '2026-09-26',
  slug: 'edicao-especial-set-2026',
  lp_url: 'https://sommaclub.com.br/edicao-especial-set-2026',
}

describe('montarLink', () => {
  it('usa o lp_url do evento quando existe', () => {
    expect(montarLink(somma, 'DAVID')).toBe(
      'https://sommaclub.com.br/edicao-especial-set-2026?parceiro=DAVID'
    )
  })

  it('cai no slug quando não há lp_url', () => {
    expect(montarLink({ ...somma, lp_url: null }, 'DAVID')).toBe(
      'https://sommaclub.com.br/edicao-especial-set-2026?parceiro=DAVID'
    )
  })

  it('não inventa link para evento sem página', () => {
    // Desafio das Esteiras hoje: sem slug e sem lp_url.
    expect(montarLink({ ...somma, slug: null, lp_url: null }, 'DAVID')).toBeNull()
  })

  it('preserva query que já existia no lp_url', () => {
    const link = montarLink({ ...somma, lp_url: 'https://sommaclub.com.br/x?lote=2' }, 'DAVID')
    expect(link).toContain('lote=2')
    expect(link).toContain('parceiro=DAVID')
  })

  it('substitui o parceiro em vez de duplicar o parâmetro', () => {
    const link = montarLink({ ...somma, lp_url: 'https://sommaclub.com.br/x?parceiro=ANTIGO' }, 'NOVO')
    expect(link).toBe('https://sommaclub.com.br/x?parceiro=NOVO')
  })

  it('sobe o código para maiúsculas', () => {
    expect(montarLink(somma, 'david')).toContain('parceiro=DAVID')
  })

  it('devolve null para código vazio ou lp_url inválido', () => {
    expect(montarLink(somma, '   ')).toBeNull()
    expect(montarLink({ ...somma, lp_url: 'nao-e-url', slug: null }, 'DAVID')).toBeNull()
  })
})

describe('eventoAberto', () => {
  const hoje = new Date('2026-09-23T12:00:00Z')

  it('aceita evento futuro', () => {
    expect(eventoAberto({ data_evento: '2026-09-26' }, hoje)).toBe(true)
  })

  it('aceita evento de hoje', () => {
    // Ainda dá para divulgar de manhã um evento que acontece à noite.
    expect(eventoAberto({ data_evento: '2026-09-23' }, hoje)).toBe(true)
  })

  it('recusa evento passado', () => {
    expect(eventoAberto({ data_evento: '2026-09-20' }, hoje)).toBe(false)
  })

  it('recusa evento marcado como encerrado, mesmo com data futura', () => {
    expect(eventoAberto({ data_evento: '2026-12-31', evento_encerrado: true }, hoje)).toBe(false)
  })
})

describe('temPaginaDeInscricao', () => {
  it('reconhece evento com lp_url ou slug', () => {
    expect(temPaginaDeInscricao(somma)).toBe(true)
    expect(temPaginaDeInscricao({ ...somma, lp_url: null })).toBe(true)
  })

  it('reconhece evento sem página', () => {
    expect(temPaginaDeInscricao({ ...somma, slug: null, lp_url: null })).toBe(false)
    expect(temPaginaDeInscricao({ ...somma, slug: '  ', lp_url: '  ' })).toBe(false)
  })
})

describe('contarInscricoes', () => {
  it('agrupa por código e evento', () => {
    const contagem = contarInscricoes([
      { evento_id: 'e1', parceiro_slug: 'DAVID' },
      { evento_id: 'e1', parceiro_slug: 'DAVID' },
      { evento_id: 'e2', parceiro_slug: 'DAVID' },
      { evento_id: 'e1', parceiro_slug: 'OUTRO' },
    ])
    expect(contagem.get(chaveContagem('DAVID', 'e1'))).toBe(2)
    expect(contagem.get(chaveContagem('DAVID', 'e2'))).toBe(1)
    expect(contagem.get(chaveContagem('OUTRO', 'e1'))).toBe(1)
  })

  it('ignora caixa e espaços do que o site gravou', () => {
    // O site grava o que veio na URL, sem normalizar: quem recebeu o link em
    // minúsculas geraria uma linha que não somaria para ninguém.
    const contagem = contarInscricoes([
      { evento_id: 'e1', parceiro_slug: 'david' },
      { evento_id: 'e1', parceiro_slug: ' DAVID ' },
    ])
    expect(contagem.get(chaveContagem('DAVID', 'e1'))).toBe(2)
  })

  it('ignora inscrições sem parceiro', () => {
    const contagem = contarInscricoes([
      { evento_id: 'e1', parceiro_slug: null },
      { evento_id: 'e1', parceiro_slug: '   ' },
    ])
    expect(contagem.size).toBe(0)
  })
})

describe('normalizarCodigo e codigoValido', () => {
  it('normaliza para maiúsculas sem espaços', () => {
    expect(normalizarCodigo(' loja parceira ')).toBe('LOJAPARCEIRA')
  })

  it('aceita código com hífen e números', () => {
    expect(codigoValido('LOJA-10')).toBe(true)
  })

  it('recusa código curto ou com símbolo', () => {
    expect(codigoValido('AB')).toBe(false)
    expect(codigoValido('LOJA@10')).toBe(false)
  })
})

describe('normalizarEventoIds', () => {
  it('mantém só uuids, sem repetição', () => {
    const ids = normalizarEventoIds([
      somma.id,
      somma.id,
      'nao-e-uuid',
      42,
      null,
    ])
    expect(ids).toEqual([somma.id])
  })

  it('devolve lista vazia para entrada que não é array', () => {
    expect(normalizarEventoIds(undefined)).toEqual([])
    expect(normalizarEventoIds('tudo')).toEqual([])
  })
})
