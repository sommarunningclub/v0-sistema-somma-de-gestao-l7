/**
 * @jest-environment node
 */
import {
  cadastroParaInput,
  diferencas,
  digitosTelefone,
  formatarCadastro,
  formatarCep,
  formatarCpf,
  formatarNascimento,
  formatarTelefone,
  inputParaCadastro,
  nascimentoParaIso,
  normalizarAlteracoes,
  paraFormulario,
  rotuloSexo,
} from '../campos'

const HOJE = new Date(2026, 10, 11) // 11/11/2026

describe('nascimentoParaIso — formatos que existem na base', () => {
  it('lê AAAA-MM-DD, DD/MM/AAAA e DD/MM/AA', () => {
    expect(nascimentoParaIso('1990-05-10')).toBe('1990-05-10')
    expect(nascimentoParaIso('10/05/1990')).toBe('1990-05-10')
    expect(nascimentoParaIso('10/05/90', 2026)).toBe('1990-05-10')
    expect(nascimentoParaIso('10/05/05', 2026)).toBe('2005-05-10')
  })

  it('devolve vazio para o que não dá para ler ou não existe', () => {
    expect(nascimentoParaIso('')).toBe('')
    expect(nascimentoParaIso(null)).toBe('')
    expect(nascimentoParaIso('10/05/199')).toBe('')
    expect(nascimentoParaIso('10051990')).toBe('')
    expect(nascimentoParaIso('31/02/1990')).toBe('')
  })

  it('formata para exibição sem cair no dia anterior (sem fuso)', () => {
    expect(formatarNascimento('1990-05-10')).toBe('10/05/1990')
    expect(formatarNascimento('10/05/1990')).toBe('10/05/1990')
    expect(formatarNascimento(null)).toBe('—')
    // Ilegível aparece como está, para não sumir da tela.
    expect(formatarNascimento('10051990')).toBe('10051990')
  })
})

describe('data de cadastro', () => {
  it('converte os três formatos da base para datetime-local em Brasília', () => {
    expect(cadastroParaInput('2026-03-02T14:05:09-03:00')).toBe('2026-03-02T14:05')
    expect(cadastroParaInput('2025-08-01')).toBe('2025-08-01T00:00')
    // ISO em UTC: 17:30Z = 14:30 em Brasília.
    expect(cadastroParaInput('2025-08-01T17:30:00.000Z')).toBe('2025-08-01T14:30')
    expect(cadastroParaInput('')).toBe('')
    expect(cadastroParaInput('ontem')).toBe('')
  })

  it('grava no formato do site, com -03:00', () => {
    expect(inputParaCadastro('2026-03-02T14:05')).toBe('2026-03-02T14:05:00-03:00')
    expect(inputParaCadastro('2026-03-02T14:05:09')).toBe('2026-03-02T14:05:09-03:00')
    expect(inputParaCadastro('2026-02-30T14:05')).toBeNull()
    expect(inputParaCadastro('2026-03-02T25:05')).toBeNull()
  })

  it('exibe com hora, menos quando o cadastro antigo não tinha hora', () => {
    expect(formatarCadastro('2026-03-02T14:05:09-03:00')).toBe('02/03/2026 14:05')
    expect(formatarCadastro('2025-08-01')).toBe('01/08/2025')
    expect(formatarCadastro(null)).toBe('—')
  })
})

describe('telefone, CPF, CEP e sexo para exibição', () => {
  it('telefone: tira +55 e o zero do DDD, e mascara', () => {
    expect(digitosTelefone('5561999998888')).toBe('61999998888')
    expect(digitosTelefone('061999998888')).toBe('61999998888')
    expect(formatarTelefone('61999998888')).toBe('(61) 99999-8888')
    expect(formatarTelefone('(61) 3333-4444')).toBe('(61) 3333-4444')
    expect(formatarTelefone('999999999')).toBe('999999999')
    expect(formatarTelefone(null)).toBe('—')
  })

  it('CPF da coluna char(14) vem com espaços à direita', () => {
    expect(formatarCpf('52998224725   ')).toBe('529.982.247-25')
    expect(formatarCpf('529.982.247-25')).toBe('529.982.247-25')
    expect(formatarCpf('1234567890    ')).toBe('1234567890')
  })

  it('CEP e sexo', () => {
    expect(formatarCep('70000000')).toBe('70000-000')
    expect(formatarCep('70000-000')).toBe('70000-000')
    expect(formatarCep(null)).toBe('—')
    expect(rotuloSexo('feminino')).toBe('Feminino')
    expect(rotuloSexo('F')).toBe('F')
    expect(rotuloSexo(null)).toBe('—')
  })
})

describe('paraFormulario + diferencas', () => {
  const linha = {
    id: 7,
    nome_completo: 'Ana Souza',
    email: 'ana@exemplo.com',
    cpf: '529.982.247-25',
    data_nascimento: '10/05/1990',
    whatsapp: '61999998888',
    cep: null,
    sexo: 'feminino',
    data_de_cadastro: '2026-03-02T14:05:09-03:00',
    cpf_digits: '52998224725',
  }

  it('monta o formulário convertendo formatos antigos', () => {
    expect(paraFormulario(linha)).toEqual({
      nome_completo: 'Ana Souza',
      email: 'ana@exemplo.com',
      cpf: '529.982.247-25',
      data_nascimento: '1990-05-10',
      sexo: 'feminino',
      whatsapp: '(61) 99999-8888',
      cep: '',
      data_de_cadastro: '2026-03-02T14:05',
    })
  })

  it('sem nada alterado não há o que enviar — o formato antigo fica intacto', () => {
    const inicial = paraFormulario(linha)
    expect(diferencas(inicial, { ...inicial })).toEqual({})
  })

  it('só o campo alterado vai para o servidor', () => {
    const inicial = paraFormulario(linha)
    expect(diferencas(inicial, { ...inicial, cep: '70000-000' })).toEqual({ cep: '70000-000' })
  })
})

describe('normalizarAlteracoes — o que o servidor grava', () => {
  it('converte para os formatos do site', () => {
    const r = normalizarAlteracoes(
      {
        nome_completo: '  Ana   Souza ',
        email: ' ANA@Exemplo.com ',
        cpf: '52998224725',
        data_nascimento: '1990-05-10',
        sexo: 'Feminino',
        whatsapp: '61 99999 8888',
        cep: '70000000',
        data_de_cadastro: '2026-03-02T14:05',
      },
      HOJE
    )
    expect(r).toEqual({
      ok: true,
      campos: {
        nome_completo: 'Ana Souza',
        email: 'ana@exemplo.com',
        cpf: '529.982.247-25',
        data_nascimento: '1990-05-10',
        sexo: 'feminino',
        whatsapp: '(61) 99999-8888',
        cep: '70000-000',
        data_de_cadastro: '2026-03-02T14:05:00-03:00',
      },
    })
  })

  it('vazio limpa o campo opcional', () => {
    expect(normalizarAlteracoes({ email: '', whatsapp: '', cep: '', sexo: '', data_nascimento: '' }, HOJE)).toEqual({
      ok: true,
      campos: { email: null, whatsapp: null, cep: null, sexo: null, data_nascimento: null },
    })
  })

  it('ignora id, cpf_digits e qualquer chave fora da lista', () => {
    expect(normalizarAlteracoes({ id: 99, cpf_digits: '000', admin: true, cep: '70000000' }, HOJE)).toEqual({
      ok: true,
      campos: { cep: '70000-000' },
    })
  })

  it.each([
    [{ nome_completo: ' ' }, 'nome_completo'],
    [{ cpf: '' }, 'cpf'],
    [{ cpf: '123.456.789-00' }, 'cpf'],
    [{ email: 'sem-arroba' }, 'email'],
    [{ whatsapp: '9999' }, 'whatsapp'],
    [{ cep: '7000' }, 'cep'],
    [{ sexo: 'x' }, 'sexo'],
    [{ data_nascimento: '2027-01-01' }, 'data_nascimento'],
    [{ data_nascimento: '1850-01-01' }, 'data_nascimento'],
    [{ data_de_cadastro: 'amanhã' }, 'data_de_cadastro'],
    [{ cep: 70000000 }, 'cep'],
  ])('recusa %j apontando o campo', (corpo, campo) => {
    const r = normalizarAlteracoes(corpo, HOJE)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.campo).toBe(campo)
  })
})
