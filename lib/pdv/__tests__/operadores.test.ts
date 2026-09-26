/**
 * @jest-environment node
 */
import {
  CODIGO_ACESSO_ALFABETO,
  CODIGO_ACESSO_TAMANHO,
  OPERADOR_EMAIL_DOMINIO,
  emailDoOperador,
  formatarCodigoAcesso,
  formatoCodigoValido,
  instrucoesDeAcesso,
  instrucoesDeAcessoInsider,
  normalizarCodigoAcesso,
  validarNovoOperador,
} from '../operadores'
import { gerarCodigoAcesso, gerarSegredoInterno } from '../operadores-server'
import { pdvLoginUrl } from '../types'

const CPF_VALIDO = '529.982.247-25'

describe('código de acesso do operador', () => {
  it('gera 8 posições só com o alfabeto sem I, O, 0 e 1', () => {
    for (let i = 0; i < 200; i += 1) {
      const codigo = gerarCodigoAcesso()
      expect(codigo).toHaveLength(CODIGO_ACESSO_TAMANHO)
      expect(formatoCodigoValido(codigo)).toBe(true)
      expect(codigo).not.toMatch(/[IO01]/)
    }
    expect(CODIGO_ACESSO_ALFABETO).not.toMatch(/[IO01]/)
  })

  it('não repete em uma amostra pequena', () => {
    const amostra = new Set(Array.from({ length: 100 }, () => gerarCodigoAcesso()))
    expect(amostra.size).toBe(100)
  })

  it('o segredo interno do Insider é bem maior que um código e nunca tem o formato dele', () => {
    const segredo = gerarSegredoInterno()
    expect(segredo).toHaveLength(32)
    expect(formatoCodigoValido(segredo)).toBe(false)
  })

  it('normaliza o que o operador digita: minúsculas, hífen e espaço', () => {
    expect(normalizarCodigoAcesso('k7p4-m2xq')).toBe('K7P4M2XQ')
    expect(normalizarCodigoAcesso(' K7P4 M2XQ ')).toBe('K7P4M2XQ')
    expect(normalizarCodigoAcesso(null)).toBe('')
  })

  it('formata em XXXX-XXXX para ditar', () => {
    expect(formatarCodigoAcesso('K7P4M2XQ')).toBe('K7P4-M2XQ')
    expect(formatarCodigoAcesso('k7p4-m2xq')).toBe('K7P4-M2XQ')
    // Incompleto não ganha hífen: seria formatar um código inválido.
    expect(formatarCodigoAcesso('K7P4')).toBe('K7P4')
  })

  it('recusa formato fora do alfabeto ou do tamanho', () => {
    expect(formatoCodigoValido('K7P4M2X')).toBe(false)
    expect(formatoCodigoValido('K7P4M2XO')).toBe(false)
    expect(formatoCodigoValido('K7P4M2X0')).toBe(false)
  })
})

describe('e-mail sintético do operador', () => {
  it('deriva do CPF só com dígitos, no domínio do PDV', () => {
    expect(emailDoOperador(CPF_VALIDO)).toBe(`52998224725@${OPERADOR_EMAIL_DOMINIO}`)
    expect(emailDoOperador('52998224725')).toBe(emailDoOperador(CPF_VALIDO))
  })
})

describe('validarNovoOperador', () => {
  it('recusa CPF inválido', () => {
    expect(validarNovoOperador({ cpf: '123.456.789-00' })).toEqual({ ok: false, erro: 'CPF inválido.' })
    expect(validarNovoOperador({})).toEqual({ ok: false, erro: 'CPF inválido.' })
    expect(validarNovoOperador(null)).toEqual({ ok: false, erro: 'CPF inválido.' })
  })

  it('devolve o CPF só com dígitos e o nome limpo', () => {
    expect(validarNovoOperador({ cpf: CPF_VALIDO, nome: '  Ana   Souza ' })).toEqual({
      ok: true,
      entrada: { cpf: '52998224725', nome: 'Ana Souza', acessoInsider: true },
    })
  })

  it('aceita nome em branco — a rota busca na base', () => {
    expect(validarNovoOperador({ cpf: CPF_VALIDO, nome: '' })).toEqual({
      ok: true,
      entrada: { cpf: '52998224725', nome: null, acessoInsider: true },
    })
  })

  it('acesso Insider só desliga quando vem false explícito', () => {
    const desligado = validarNovoOperador({ cpf: CPF_VALIDO, acesso_insider: false })
    expect(desligado.ok && desligado.entrada.acessoInsider).toBe(false)
    const lixo = validarNovoOperador({ cpf: CPF_VALIDO, acesso_insider: 'nao' })
    expect(lixo.ok && lixo.entrada.acessoInsider).toBe(true)
  })

  it('recusa nome de uma letra e nome longo demais', () => {
    expect(validarNovoOperador({ cpf: CPF_VALIDO, nome: 'A' }).ok).toBe(false)
    expect(validarNovoOperador({ cpf: CPF_VALIDO, nome: 'x'.repeat(121) }).ok).toBe(false)
  })
})

describe('instruções de acesso', () => {
  it('traz URL de login, CPF mascarado e código formatado', () => {
    const texto = instrucoesDeAcesso({
      nome: 'Ana Souza',
      cpf: '52998224725',
      codigo: 'K7P4M2XQ',
      loginUrl: 'https://pdv.sommaclub.com.br/login',
    })
    expect(texto).toContain('Ana Souza')
    expect(texto).toContain('529.982.247-25')
    expect(texto).toContain('K7P4-M2XQ')
    expect(texto).toContain('https://pdv.sommaclub.com.br/login')
  })

  it('para Insider, pede só o CPF e não traz código', () => {
    const texto = instrucoesDeAcessoInsider({
      nome: 'Ana Souza',
      cpf: '52998224725',
      loginUrl: 'https://pdv.sommaclub.com.br/login',
    })
    expect(texto).toContain('Sou Insider')
    expect(texto).toContain('529.982.247-25')
    expect(texto).not.toMatch(/Código de acesso:/)
  })
})

describe('pdvLoginUrl', () => {
  it('aponta para /login no domínio do PDV', () => {
    expect(pdvLoginUrl()).toBe('https://pdv.sommaclub.com.br/login')
  })
})
