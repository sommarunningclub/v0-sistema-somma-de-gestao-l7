import { AUDIENCE_SOURCES, buildAudienceQuery, isAudienceKey, individuaisToRecipients } from '../audiences'

describe('AUDIENCE_SOURCES', () => {
  it('declares the four bases from the spec', () => {
    expect(Object.keys(AUDIENCE_SOURCES).sort()).toEqual(
      ['checkins', 'lista_espera', 'lista_vip', 'membros'].sort(),
    )
  })

  it('maps each base to its real table and columns', () => {
    expect(AUDIENCE_SOURCES.membros.table).toBe('cadastro_site')
    expect(AUDIENCE_SOURCES.membros.nameCol).toBe('nome_completo')

    expect(AUDIENCE_SOURCES.checkins.table).toBe('checkins')
    expect(AUDIENCE_SOURCES.checkins.nameCol).toBe('nome_completo')

    expect(AUDIENCE_SOURCES.lista_vip.table).toBe('lista_vip')
    expect(AUDIENCE_SOURCES.lista_vip.nameCol).toBe('nome')

    expect(AUDIENCE_SOURCES.lista_espera.table).toBe('lista_vip_assessoria')
    expect(AUDIENCE_SOURCES.lista_espera.nameCol).toBe('nome')
  })

  it('uses email as the address column everywhere', () => {
    for (const source of Object.values(AUDIENCE_SOURCES)) {
      expect(source.emailCol).toBe('email')
    }
  })

  it('declares the filters from the spec', () => {
    expect(AUDIENCE_SOURCES.checkins.filters.map((f) => f.key).sort()).toEqual(
      ['evento_id', 'pelotao', 'sexo'].sort(),
    )
    expect(AUDIENCE_SOURCES.membros.filters).toEqual([])
    expect(AUDIENCE_SOURCES.lista_vip.filters.map((f) => f.key)).toEqual(['status_cupom'])
    expect(AUDIENCE_SOURCES.lista_espera.filters.map((f) => f.key).sort()).toEqual(
      ['cidade', 'sexo', 'status'].sort(),
    )
  })
})

describe('isAudienceKey', () => {
  it('accepts known keys and rejects the rest', () => {
    expect(isAudienceKey('membros')).toBe(true)
    expect(isAudienceKey('users')).toBe(false)
    expect(isAudienceKey('')).toBe(false)
  })
})

describe('buildAudienceQuery', () => {
  it('selects the email and name columns', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.membros, {})
    expect(q.table).toBe('cadastro_site')
    expect(q.select).toBe('email,nome_completo')
    expect(q.eq).toEqual([])
  })

  it('applies declared filters', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.checkins, { pelotao: 'A', sexo: 'F' })
    expect(q.eq).toEqual(
      expect.arrayContaining([
        ['pelotao', 'A'],
        ['sexo', 'F'],
      ]),
    )
    expect(q.eq).toHaveLength(2)
  })

  it('ignores undeclared filters', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.membros, { cpf: '123' })
    expect(q.eq).toEqual([])
  })

  it('ignores empty filter values', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.checkins, { pelotao: '', sexo: '   ' })
    expect(q.eq).toEqual([])
  })

  it('trims filter values', () => {
    const q = buildAudienceQuery(AUDIENCE_SOURCES.lista_espera, { cidade: '  Brasília  ' })
    expect(q.eq).toEqual([['cidade', 'Brasília']])
  })
})

describe('individuaisToRecipients', () => {
  it('converte para destinatários com a base de origem "individual"', () => {
    const out = individuaisToRecipients([{ email: 'a@x.com', nome: 'Ana' }])
    expect(out).toEqual([{ email: 'a@x.com', nome: 'Ana', sourceBase: 'individual' }])
  })

  it('normaliza o e-mail', () => {
    const out = individuaisToRecipients([{ email: '  A@X.COM ', nome: null }])
    expect(out[0].email).toBe('a@x.com')
  })

  it('descarta e-mail inválido', () => {
    const out = individuaisToRecipients([
      { email: 'sem-arroba', nome: null },
      { email: 'ok@x.com', nome: null },
    ])
    expect(out.map((r) => r.email)).toEqual(['ok@x.com'])
  })

  it('preserva nome nulo', () => {
    const out = individuaisToRecipients([{ email: 'a@x.com', nome: null }])
    expect(out[0].nome).toBeNull()
  })

  it('devolve vazio para entrada vazia ou ausente', () => {
    expect(individuaisToRecipients([])).toEqual([])
    expect(individuaisToRecipients(undefined)).toEqual([])
  })
})
