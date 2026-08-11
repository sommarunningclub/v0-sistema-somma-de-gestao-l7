import {
  ETAPAS,
  etapaLabel,
  etapaTone,
  isEtapa,
  mensagemWhatsapp,
  whatsappHref,
} from '@/lib/vagas-constants'

/** Extrai só o número do link, para as asserções ficarem legíveis. */
function numero(telefone: string): string | null {
  const href = whatsappHref(telefone)
  return href ? href.replace('https://wa.me/', '') : null
}

describe('whatsappHref', () => {
  it('normaliza o telefone mascarado que o formulário grava', () => {
    expect(numero('(61) 99902-7080')).toBe('5561999027080')
    expect(numero('61999027080')).toBe('5561999027080')
  })

  it('aceita fixo com DDD', () => {
    expect(numero('(61) 3333-4444')).toBe('556133334444')
  })

  it('não confunde o DDD 55 com o código do Brasil', () => {
    // Caxias do Sul é DDD 55. Tratar o prefixo como DDI mandaria a mensagem
    // para um número truncado — e o erro seria silencioso.
    expect(numero('(55) 99999-9999')).toBe('5555999999999')
  })

  it('não duplica o DDI quando ele já veio', () => {
    expect(numero('5561999027080')).toBe('5561999027080')
    expect(numero('+55 61 99902-7080')).toBe('5561999027080')
  })

  it('devolve null para o que não dá para discar', () => {
    expect(whatsappHref('99902-7080')).toBeNull() // sem DDD
    expect(whatsappHref('123')).toBeNull()
    expect(whatsappHref('')).toBeNull()
    expect(whatsappHref(null)).toBeNull()
    expect(whatsappHref(undefined)).toBeNull()
  })

  it('embute a mensagem codificada quando ela é passada', () => {
    const href = whatsappHref('(61) 99902-7080', 'Olá, Alex! Tudo certo?')
    expect(href).toContain('?text=')
    expect(href).toContain(encodeURIComponent('Olá, Alex! Tudo certo?'))
  })

  it('não põe query quando não há mensagem', () => {
    expect(whatsappHref('(61) 99902-7080')).not.toContain('?')
  })
})

describe('mensagemWhatsapp', () => {
  it('trata a pessoa pelo primeiro nome e cita a vaga', () => {
    const msg = mensagemWhatsapp('Alex Rodrigues dos Santos', 'Estagiário(a) de Educação Física')
    expect(msg).toContain('Olá, Alex!')
    expect(msg).toContain('Estagiário(a) de Educação Física')
    expect(msg).not.toContain('Rodrigues')
  })

  it('aguenta nome de uma palavra só', () => {
    expect(mensagemWhatsapp('Alex', 'Estágio')).toContain('Olá, Alex!')
  })
})

describe('etapas da triagem', () => {
  it('reconhece as cinco etapas e rejeita o resto', () => {
    for (const etapa of ETAPAS) expect(isEtapa(etapa.value)).toBe(true)
    expect(isEtapa('etapa-que-nao-existe')).toBe(false)
    expect(isEtapa(null)).toBe(false)
    expect(isEtapa(42)).toBe(false)
  })

  it('cai em "Novo" quando o status vem vazio do banco', () => {
    expect(etapaLabel(null)).toBe('Novo')
    expect(etapaLabel('')).toBe('Novo')
  })

  it('dá tom neutro para status desconhecido em vez de quebrar', () => {
    expect(etapaTone('sei-la')).toBe('neutral')
    expect(etapaTone('aprovado')).toBe('success')
    expect(etapaTone('reprovado')).toBe('danger')
  })
})
