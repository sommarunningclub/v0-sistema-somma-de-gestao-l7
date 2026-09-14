import {
  CANAIS,
  comOrigem,
  linkDaRodada,
  linkPessoal,
  linkWhatsapp,
  mensagemConvite,
  normalizarTelefoneBr,
  rotuloDaOrigem,
  slugDeOrigem,
} from '../links'
import { capitalizarNome, separarNomeCompleto } from '../nome'

describe('links de divulgação', () => {
  it('monta o link da rodada e o pessoal no domínio do site', () => {
    expect(linkDaRodada('2026-set-out')).toBe('https://sommaclub.com.br/assessoria/nps/2026-set-out')
    expect(linkPessoal('abc_DEF-123')).toBe('https://sommaclub.com.br/assessoria/nps/convite/abc_DEF-123')
  })

  it('acrescenta a origem normalizada como o site grava', () => {
    expect(comOrigem(linkDaRodada('2026-set-out'), 'Stories Instagram!')).toBe(
      'https://sommaclub.com.br/assessoria/nps/2026-set-out?origem=stories-instagram',
    )
    expect(comOrigem(linkDaRodada('x'), '   ')).toBe('https://sommaclub.com.br/assessoria/nps/x')
    expect(slugDeOrigem('Promoção de Setembro')).toBe('promocao-de-setembro')
  })

  it('usa canais que já estão no formato gravado', () => {
    for (const canal of CANAIS) expect(slugDeOrigem(canal.id)).toBe(canal.id)
    expect(rotuloDaOrigem('whatsapp-grupos')).toBe('Grupos de WhatsApp')
    expect(rotuloDaOrigem('invite')).toBe('Link pessoal')
    expect(rotuloDaOrigem('campanha-x')).toBe('campanha-x')
  })

  it('normaliza celular brasileiro para o wa.me', () => {
    expect(normalizarTelefoneBr('(61) 99999-8888')).toBe('5561999998888')
    expect(normalizarTelefoneBr('+55 61 99999-8888')).toBe('5561999998888')
    expect(normalizarTelefoneBr('123')).toBeNull()
    expect(linkWhatsapp('(61) 99999-8888', 'Oi, Ana')).toBe('https://wa.me/5561999998888?text=Oi%2C%20Ana')
    expect(linkWhatsapp(null, 'Oi')).toBeNull()
  })

  it('escreve a mensagem do convite sem travessão', () => {
    const texto = mensagemConvite('Ana', 'https://x', 'set–out 2026')
    expect(texto).toContain('Oi, Ana!')
    expect(texto).toContain('https://x')
    expect(texto).not.toContain('—')
  })
})

describe('nome do convite', () => {
  it('apresenta o nome do cadastro do jeito que a pessoa escreveria', () => {
    expect(capitalizarNome('  MARIA   DE LOURDES COSTA ')).toBe('Maria de Lourdes Costa')
    expect(capitalizarNome('McArthur Silva')).toBe('McArthur Silva')
    expect(separarNomeCompleto('JOÃO DA SILVA')).toEqual({ nome: 'João', sobrenome: 'da Silva' })
    expect(separarNomeCompleto('Cher')).toEqual({ nome: 'Cher', sobrenome: '' })
  })
})
