import { nomeCasaCom, normalizarParaBusca } from '../nome'
import { editarRespostaSchema } from '../validacao'

describe('nome', () => {
  it('normaliza como a coluna full_name_normalized do site', () => {
    expect(normalizarParaBusca('  José  dos Santos ')).toBe('jose santos')
    expect(normalizarParaBusca("Maria-Clara D'Ávila")).toBe('maria clara avila')
  })

  it('reconhece o professor do cadastro sem caixa nem acento', () => {
    expect(nomeCasaCom('Joseph Pereira', 'Joseph pereira')).toBe(true)
    expect(nomeCasaCom('Joseph Pereira', 'JOSEPH DA SILVA PEREIRA')).toBe(true)
    expect(nomeCasaCom('Joseph Pereira', 'Joseph')).toBe(false)
    expect(nomeCasaCom('Alexandre Alves', 'Mateus Fonseca')).toBe(false)
  })
})

describe('edição de resposta', () => {
  const PROFESSOR = '76b37fc1-a7c0-47e2-a9a5-6e51d5fc0981'
  const erro = (valor: unknown) => {
    const r = editarRespostaSchema.safeParse(valor)
    return r.success ? null : r.error.issues[0]?.message
  }

  it('aceita corrigir nome e professor, limpando espaços', () => {
    const r = editarRespostaSchema.safeParse({ first_name: '  Ana  ', last_name: 'de  Souza', professor_id: PROFESSOR })
    expect(r.success && r.data).toEqual({ first_name: 'Ana', last_name: 'de Souza', professor_id: PROFESSOR })
  })

  it('aceita tirar o professor', () => {
    expect(editarRespostaSchema.safeParse({ professor_id: null }).success).toBe(true)
  })

  it('recusa nome inválido, professor inválido e pedido vazio', () => {
    expect(erro({ first_name: 'A' })).toBe('Escreva o nome completo.')
    expect(erro({ first_name: '   ' })).toBe('Informe o nome.')
    expect(erro({ last_name: 'Silva 2' })).toBe('Use apenas letras no sobrenome.')
    expect(erro({ professor_id: 'joseph' })).toBe('Professor inválido.')
    expect(erro({})).toBe('Nada para alterar.')
  })

  it('não edita nota: campo fora da lista é ignorado', () => {
    expect(erro({ nps_score: 10 })).toBe('Nada para alterar.')
  })
})
