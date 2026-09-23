import { estaArquivada, motivoNaoArquivavel, podeArquivar, STATUS_ARQUIVAVEIS } from '../arquivar'
import type { CampaignStatus } from '../types'

// A regra que importa aqui não é de tela: arquivar esconde a campanha da
// listagem, e esconder algo que ainda vai disparar é como perder o controle do
// envio. Os testes abaixo fixam quais estados podem sumir de vista.

describe('podeArquivar', () => {
  it('permite arquivar o que já terminou', () => {
    expect(podeArquivar('enviada')).toBe(true)
    expect(podeArquivar('cancelada')).toBe(true)
    expect(podeArquivar('erro')).toBe(true)
  })

  it('recusa campanha agendada', () => {
    // Sumiria da tela e dispararia sozinha dias depois.
    expect(podeArquivar('agendada')).toBe(false)
  })

  it('recusa campanha em envio', () => {
    // O cron está processando ela agora.
    expect(podeArquivar('enviando')).toBe(false)
  })

  it('recusa rascunho', () => {
    // Rascunho é trabalho em aberto, não histórico.
    expect(podeArquivar('rascunho')).toBe(false)
  })

  it('cobre todos os status conhecidos, sem deixar nenhum indefinido', () => {
    // Se um status novo entrar no tipo, este teste obriga a decidir de que
    // lado ele fica em vez de herdar `false` por acidente.
    const todos: CampaignStatus[] = [
      'rascunho',
      'agendada',
      'enviando',
      'enviada',
      'cancelada',
      'erro',
    ]
    const arquivaveis = todos.filter(podeArquivar)
    expect(arquivaveis.sort()).toEqual([...STATUS_ARQUIVAVEIS].sort())
  })
})

describe('motivoNaoArquivavel', () => {
  it('explica o caso da agendada citando o disparo pendente', () => {
    expect(motivoNaoArquivavel('agendada')).toContain('ainda vai disparar')
  })

  it('explica o caso da que está enviando', () => {
    expect(motivoNaoArquivavel('enviando')).toContain('em envio')
  })

  it('dá um motivo genérico para os demais', () => {
    expect(motivoNaoArquivavel('rascunho')).toContain('enviadas, canceladas ou com erro')
  })
})

describe('estaArquivada', () => {
  it('considera arquivada quando há data', () => {
    expect(estaArquivada({ archived_at: '2026-09-20T12:00:00Z' })).toBe(true)
  })

  it('considera ativa quando é null', () => {
    expect(estaArquivada({ archived_at: null })).toBe(false)
  })

  it('trata ausência do campo como ativa', () => {
    // Campanha vinda de um cache antigo, anterior à coluna.
    expect(estaArquivada({} as { archived_at: string | null })).toBe(false)
  })
})
