import {
  bimestreDaData,
  bimestresParaEscolha,
  deCampoDataHora,
  janelaSugerida,
  lerReferencia,
  paraCampoDataHora,
  proximoBimestre,
  referenciaDoBimestre,
  rotuloDaReferencia,
  slugDoBimestre,
  tituloPadrao,
} from '../periodo'
import { estadoDaRodada } from '../estado'

describe('bimestres das rodadas', () => {
  it('lê e escreve a referência gravada no banco', () => {
    expect(referenciaDoBimestre({ ano: 2026, numero: 5 })).toBe('2026-B5')
    expect(lerReferencia('2026-B5')).toEqual({ ano: 2026, numero: 5 })
    expect(lerReferencia('2026-09')).toBeNull()
    expect(lerReferencia('2026-B7')).toBeNull()
  })

  it('gera rótulo, código do link e título', () => {
    expect(rotuloDaReferencia('2026-B5')).toBe('set–out 2026')
    expect(slugDoBimestre({ ano: 2026, numero: 5 })).toBe('2026-set-out')
    expect(tituloPadrao({ ano: 2027, numero: 1 })).toBe('NPS da Assessoria · jan–fev 2027')
    // Referência fora do padrão aparece como veio, em vez de sumir.
    expect(rotuloDaReferencia('especial-2026')).toBe('especial-2026')
  })

  it('usa o relógio de Brasília para saber o bimestre', () => {
    // 31/10 às 23h em Brasília ainda é set–out, mesmo já sendo 1/11 em UTC.
    expect(bimestreDaData(new Date('2026-11-01T02:00:00Z'))).toEqual({ ano: 2026, numero: 5 })
    expect(bimestreDaData(new Date('2026-11-01T03:00:00Z'))).toEqual({ ano: 2026, numero: 6 })
  })

  it('vira o ano depois de nov–dez', () => {
    expect(proximoBimestre({ ano: 2026, numero: 6 })).toEqual({ ano: 2027, numero: 1 })
  })

  it('oferece o anterior, o atual e os próximos', () => {
    const lista = bimestresParaEscolha(new Date('2026-09-14T12:00:00Z'), 2)
    expect(lista.map(referenciaDoBimestre)).toEqual(['2026-B4', '2026-B5', '2026-B6', '2027-B1'])
  })

  it('sugere para bimestre futuro: abre às 7h do dia 1 e fecha às 23h59 do 15º dia', () => {
    const { abre, fecha } = janelaSugerida({ ano: 2026, numero: 6 }, new Date('2026-09-14T12:00:00Z'))
    expect(abre.toISOString()).toBe('2026-11-01T10:00:00.000Z')
    expect(fecha.toISOString()).toBe('2026-11-16T02:59:00.000Z')
  })

  it('sugere para bimestre em curso: abre na próxima hora cheia', () => {
    const { abre } = janelaSugerida({ ano: 2026, numero: 5 }, new Date('2026-09-14T12:34:00Z'))
    expect(abre.toISOString()).toBe('2026-09-14T13:00:00.000Z')
  })

  it('converte o campo datetime-local sempre em Brasília', () => {
    expect(paraCampoDataHora('2026-11-01T10:00:00.000Z')).toBe('2026-11-01T07:00')
    expect(deCampoDataHora('2026-11-01T07:00')).toBe('2026-11-01T10:00:00.000Z')
    expect(deCampoDataHora('01/11/2026')).toBeNull()
    expect(paraCampoDataHora(null)).toBe('')
  })
})

describe('estado da rodada', () => {
  const publicada = { status: 'active' as const, opens_at: '2026-11-01T10:00:00Z', closes_at: '2026-11-16T02:59:00Z' }

  it('deriva agendada, no ar e encerrada da janela', () => {
    expect(estadoDaRodada(publicada, new Date('2026-10-31T00:00:00Z'))).toBe('agendada')
    expect(estadoDaRodada(publicada, new Date('2026-11-01T10:00:00Z'))).toBe('no_ar')
    expect(estadoDaRodada(publicada, new Date('2026-11-16T02:59:00Z'))).toBe('encerrada')
  })

  it('respeita rascunho e encerramento manual', () => {
    expect(estadoDaRodada({ ...publicada, status: 'draft' }, new Date('2026-11-05T00:00:00Z'))).toBe('rascunho')
    expect(estadoDaRodada({ ...publicada, status: 'closed' }, new Date('2026-11-05T00:00:00Z'))).toBe('encerrada')
  })

  it('sem data de fechamento fica no ar', () => {
    expect(estadoDaRodada({ ...publicada, closes_at: null }, new Date('2030-01-01T00:00:00Z'))).toBe('no_ar')
  })
})
