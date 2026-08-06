import {
  cpfCandidates,
  toInsiderPublic,
  buildInsiderRow,
  INSIDER_PUBLIC_COLUMNS,
} from '../insider-mapper'

describe('cpfCandidates', () => {
  it('devolve as duas grafias a partir do formato com máscara', () => {
    expect(cpfCandidates('529.982.247-25')).toEqual(['52998224725', '529.982.247-25'])
  })

  it('devolve as duas grafias a partir dos dígitos crus', () => {
    expect(cpfCandidates('52998224725')).toEqual(['52998224725', '529.982.247-25'])
  })

  it('não duplica quando não há 11 dígitos', () => {
    expect(cpfCandidates('529')).toEqual(['529'])
  })
})

describe('INSIDER_PUBLIC_COLUMNS', () => {
  it('não expõe colunas de benefício', () => {
    for (const proibida of [
      'evolve',
      'dopahmina',
      'tex_barbearia',
      'cupom_loja_somma',
      'big_box',
      'assessoria_somma',
      'estamina_recovery',
    ]) {
      expect(INSIDER_PUBLIC_COLUMNS).not.toContain(proibida)
    }
  })

  it('inclui o id e os campos de cadastro', () => {
    expect(INSIDER_PUBLIC_COLUMNS).toContain('id')
    expect(INSIDER_PUBLIC_COLUMNS).toContain('foto_url')
    expect(INSIDER_PUBLIC_COLUMNS).toContain('data_nascimento')
  })
})

describe('toInsiderPublic', () => {
  const row = {
    id: 'uuid-1',
    nome: 'João Silva',
    email: 'joao@exemplo.com',
    telefone: '(61) 99999-8888',
    data_nascimento: '1990-03-15',
    sexo: 'masculino',
    cep: '70000-000',
    logradouro: 'SQN 210',
    numero: '101',
    complemento: null,
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    estado: 'DF',
    foto_url: 'https://exemplo.com/foto.jpg',
  }

  it('converte a data ISO para DD/MM/AAAA', () => {
    expect(toInsiderPublic(row, false).data_nascimento).toBe('15/03/1990')
  })

  it('troca nulos por string vazia', () => {
    expect(toInsiderPublic(row, false).complemento).toBe('')
  })

  it('propaga temSenha', () => {
    expect(toInsiderPublic(row, true).tem_senha).toBe(true)
    expect(toInsiderPublic(row, false).tem_senha).toBe(false)
  })

  it('nunca inclui hash de senha nem benefícios', () => {
    const publico = toInsiderPublic({ ...row, senha_hash: 'x', evolve: 'CUPOM10' }, false) as Record<
      string,
      unknown
    >
    expect(publico.senha_hash).toBeUndefined()
    expect(publico.evolve).toBeUndefined()
  })
})

describe('buildInsiderRow', () => {
  const input = {
    cpf: '529.982.247-25',
    nome: '  João Silva  ',
    email: 'joao@exemplo.com',
    telefone: '61999998888',
    data_nascimento: '15/03/1990',
    sexo: 'masculino',
    cep: '70000000',
    logradouro: 'SQN 210',
    numero: '101',
    complemento: '',
    bairro: 'Asa Norte',
    cidade: 'Brasília',
    estado: 'df',
    consent_lgpd: true,
    consent_imagem: true,
  }

  it('normaliza telefone, cep, uf e data', () => {
    const row = buildInsiderRow(input)
    expect(row.telefone).toBe('(61) 99999-8888')
    expect(row.cep).toBe('70000-000')
    expect(row.estado).toBe('DF')
    expect(row.data_nascimento).toBe('1990-03-15')
    expect(row.nome).toBe('João Silva')
  })

  it('não inclui cpf nem foto_url (a rota decide)', () => {
    const row = buildInsiderRow(input)
    expect(row.cpf).toBeUndefined()
    expect(row.foto_url).toBeUndefined()
  })

  it('não toca em colunas de benefício', () => {
    const row = buildInsiderRow(input)
    expect(Object.keys(row)).not.toContain('evolve')
    expect(Object.keys(row)).not.toContain('dopahmina')
  })

  it('grava complemento vazio como null', () => {
    expect(buildInsiderRow(input).complemento).toBeNull()
  })

  it('rejeita data_nascimento malformada', () => {
    const malformedInput = { ...input, data_nascimento: '15/03/90' }
    expect(() => buildInsiderRow(malformedInput)).toThrow(/data_nascimento malformada/)
  })
})
