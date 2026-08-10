import { toAccentInsensitiveRegex, applyMemberSearch } from '../member-search'

/** Espião mínimo com a forma que o PostgREST expõe: `.or()` encadeável. */
function fakeQuery() {
  const calls: string[] = []
  const q = { or: (f: string) => { calls.push(f); return q } }
  return { q, calls }
}

describe('toAccentInsensitiveRegex', () => {
  it('expande vogais acentuadas em classes de caractere', () => {
    const re = toAccentInsensitiveRegex('joao')
    expect(re).toContain('[aáàâã')
    expect(re).toContain('[oóòôõ')
  })

  it('trata a letra c como classe com cedilha', () => {
    expect(toAccentInsensitiveRegex('caca')).toContain('[cç]')
  })

  it('escapa caracteres especiais de regex', () => {
    const re = toAccentInsensitiveRegex('a.b*c')
    expect(re).toContain('\\.')
    expect(re).toContain('\\*')
  })

  it('devolve string vazia para entrada vazia', () => {
    expect(toAccentInsensitiveRegex('')).toBe('')
  })
})

describe('applyMemberSearch', () => {
  it('gera um filtro por termo (AND entre termos)', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, 'maria silva')
    expect(calls).toHaveLength(2)
  })

  it('cada filtro cobre nome e e-mail', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, 'maria')
    expect(calls[0]).toContain('nome_completo')
    expect(calls[0]).toContain('email')
  })

  it('busca por dígitos quando o termo tem 3 ou mais números', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, '61999')
    expect(calls[0]).toMatch(/cpf|whatsapp/)
  })

  it('não gera filtro para termo vazio', () => {
    const { q, calls } = fakeQuery()
    applyMemberSearch(q, '   ')
    expect(calls).toHaveLength(0)
  })

  it('devolve a própria query, para permitir encadeamento', () => {
    const { q } = fakeQuery()
    expect(applyMemberSearch(q, 'ana')).toBe(q)
  })
})
