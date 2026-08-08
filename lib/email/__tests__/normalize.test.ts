import { normalizeEmail, dedupeRecipients } from '../normalize'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Joao@Example.COM ')).toBe('joao@example.com')
  })

  it('rejects values without @', () => {
    expect(normalizeEmail('joao')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
  })

  it('rejects malformed addresses', () => {
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('@example.com')).toBeNull()
    expect(normalizeEmail('joao@@example.com')).toBeNull()
    expect(normalizeEmail('joao @example.com')).toBeNull()
  })

  it('accepts a normal address', () => {
    expect(normalizeEmail('joao.silva+tag@example.com.br')).toBe('joao.silva+tag@example.com.br')
  })
})

describe('dedupeRecipients', () => {
  it('keeps the first occurrence across lists', () => {
    const result = dedupeRecipients([
      [{ email: 'a@x.com', nome: 'Ana', sourceBase: 'membros' }],
      [{ email: 'a@x.com', nome: 'Ana Maria', sourceBase: 'checkins' }],
    ])
    expect(result).toHaveLength(1)
    expect(result[0].sourceBase).toBe('membros')
    expect(result[0].nome).toBe('Ana')
  })

  it('dedupes within a single list', () => {
    const result = dedupeRecipients([
      [
        { email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' },
        { email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' },
        { email: 'b@x.com', nome: 'Bia', sourceBase: 'checkins' },
      ],
    ])
    expect(result.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com'])
  })

  it('normalizes before comparing', () => {
    const result = dedupeRecipients([
      [{ email: ' A@X.com ', nome: 'Ana', sourceBase: 'membros' }],
      [{ email: 'a@x.com', nome: 'Ana', sourceBase: 'checkins' }],
    ])
    expect(result).toHaveLength(1)
    expect(result[0].email).toBe('a@x.com')
  })

  it('drops invalid addresses', () => {
    const result = dedupeRecipients([
      [
        { email: 'sem-arroba', nome: null, sourceBase: 'membros' },
        { email: 'ok@x.com', nome: null, sourceBase: 'membros' },
      ],
    ])
    expect(result.map((r) => r.email)).toEqual(['ok@x.com'])
  })

  it('returns empty for empty input', () => {
    expect(dedupeRecipients([])).toEqual([])
    expect(dedupeRecipients([[], []])).toEqual([])
  })

  it('preserves nome null', () => {
    const result = dedupeRecipients([[{ email: 'a@x.com', nome: null, sourceBase: 'membros' }]])
    expect(result[0].nome).toBeNull()
  })
})
