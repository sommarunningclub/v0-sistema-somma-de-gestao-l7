import {
  onlyDigits,
  maskCpf,
  isValidCpf,
  maskDate,
  isValidBirthDate,
  brDateToISO,
  isoToBrDate,
  maskCep,
  maskPhone,
  maskUf,
  insiderFormSchema,
  validateSenha,
  firstZodError,
} from '../validation'

const validForm = {
  cpf: '529.982.247-25',
  nome: 'João Silva Santos',
  email: 'joao@exemplo.com',
  telefone: '(61) 99999-9999',
  data_nascimento: '15/03/1990',
  sexo: 'masculino',
  cep: '70000-000',
  logradouro: 'SQN 210 Bloco A',
  numero: '101',
  complemento: '',
  bairro: 'Asa Norte',
  cidade: 'Brasília',
  estado: 'DF',
  consent_lgpd: true,
  consent_imagem: true,
}

describe('máscaras', () => {
  it('maskCpf formata progressivamente e trava em 11 dígitos', () => {
    expect(maskCpf('529')).toBe('529')
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('529982247259999')).toBe('529.982.247-25')
  })

  it('maskCep formata 8 dígitos', () => {
    expect(maskCep('70000')).toBe('70000')
    expect(maskCep('70000000')).toBe('70000-000')
  })

  it('maskPhone formata fixo e celular', () => {
    expect(maskPhone('6133334444')).toBe('(61) 3333-4444')
    expect(maskPhone('61999998888')).toBe('(61) 99999-8888')
  })

  it('maskDate formata DD/MM/AAAA', () => {
    expect(maskDate('15')).toBe('15')
    expect(maskDate('1503')).toBe('15/03')
    expect(maskDate('15031990')).toBe('15/03/1990')
  })

  it('maskUf devolve 2 letras maiúsculas', () => {
    expect(maskUf('df')).toBe('DF')
    expect(maskUf('s1p')).toBe('SP')
  })

  it('onlyDigits remove tudo que não é dígito', () => {
    expect(onlyDigits('(61) 99999-8888')).toBe('61999998888')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF com dígitos verificadores corretos', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('rejeita dígito verificador errado, tamanho errado e repetição', () => {
    expect(isValidCpf('529.982.247-26')).toBe(false)
    expect(isValidCpf('5299822472')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
  })
})

describe('datas', () => {
  it('isValidBirthDate aceita data real e rejeita inválidas', () => {
    expect(isValidBirthDate('15/03/1990')).toBe(true)
    expect(isValidBirthDate('31/02/1990')).toBe(false)
    expect(isValidBirthDate('15/13/1990')).toBe(false)
    expect(isValidBirthDate('15/03/1890')).toBe(false)
    expect(isValidBirthDate('15-03-1990')).toBe(false)
  })

  it('rejeita ano no futuro', () => {
    const futuro = new Date().getFullYear() + 1
    expect(isValidBirthDate(`15/03/${futuro}`)).toBe(false)
  })

  it('converte entre BR e ISO', () => {
    expect(brDateToISO('15/03/1990')).toBe('1990-03-15')
    expect(brDateToISO('15/03/90')).toBeNull()
    expect(isoToBrDate('1990-03-15')).toBe('15/03/1990')
    expect(isoToBrDate(null)).toBe('')
    expect(isoToBrDate('')).toBe('')
  })
})

describe('insiderFormSchema', () => {
  it('aceita um formulário completo', () => {
    const result = insiderFormSchema.safeParse(validForm)
    expect(result.success).toBe(true)
  })

  it('normaliza e-mail para minúsculas e sem espaços', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, email: '  JOAO@Exemplo.COM ' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('joao@exemplo.com')
  })

  it('rejeita CPF inválido', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, cpf: '111.111.111-11' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('CPF inválido.')
  })

  it('rejeita nome curto', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, nome: 'Jo' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('Informe seu nome completo.')
  })

  it('rejeita CEP com menos de 8 dígitos', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, cep: '70000-0' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('CEP inválido.')
  })

  it('rejeita UF com tamanho diferente de 2', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, estado: 'DFF' })
    expect(result.success).toBe(false)
  })

  it('rejeita sexo fora das opções', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, sexo: 'outro' })
    expect(result.success).toBe(false)
    if (!result.success) expect(firstZodError(result.error)).toBe('Selecione uma opção.')
  })

  it('exige os dois consentimentos', () => {
    const semLgpd = insiderFormSchema.safeParse({ ...validForm, consent_lgpd: false })
    expect(semLgpd.success).toBe(false)
    if (!semLgpd.success) {
      expect(firstZodError(semLgpd.error)).toBe(
        'É preciso aceitar o Termo de Consentimento de Dados (LGPD).'
      )
    }

    const semImagem = insiderFormSchema.safeParse({ ...validForm, consent_imagem: false })
    expect(semImagem.success).toBe(false)
  })

  it('aceita complemento vazio', () => {
    const result = insiderFormSchema.safeParse({ ...validForm, complemento: '' })
    expect(result.success).toBe(true)
  })
})

describe('validateSenha', () => {
  it('exige senha quando obrigatória', () => {
    expect(validateSenha('', '', true)).toBe('Crie uma senha de acesso.')
  })

  it('permite senha vazia quando não obrigatória', () => {
    expect(validateSenha('', '', false)).toBeNull()
  })

  it('exige mínimo de 8 caracteres', () => {
    expect(validateSenha('1234567', '1234567', true)).toBe(
      'A senha deve ter ao menos 8 caracteres.'
    )
  })

  it('exige confirmação igual', () => {
    expect(validateSenha('senha12345', 'senha54321', true)).toBe('As senhas não conferem.')
  })

  it('aceita senha válida', () => {
    expect(validateSenha('senha12345', 'senha12345', true)).toBeNull()
    expect(validateSenha('senha12345', 'senha12345', false)).toBeNull()
  })

  it('rejeita senha com mais de 72 caracteres (bcrypt trunca)', () => {
    const senhaLonga = 'a'.repeat(73)
    expect(validateSenha(senhaLonga, senhaLonga, true)).toBe(
      'A senha deve ter no máximo 72 caracteres.'
    )
  })
})
