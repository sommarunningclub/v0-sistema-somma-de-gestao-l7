import {
  formatarDataBR,
  formatarDataHoraBR,
  formatarDataPura,
  formatarHoraBR,
} from '../datas'

// Estes testes seguram o bug que apareceu na lista de check-in: o servidor da
// Vercel roda em UTC, e formatar sem dizer o fuso mostrava 19:13 para um
// check-in das 16:13. Como o fuso está fixo no formatador, o resultado não
// depende de onde o teste roda.

describe('formatarDataHoraBR', () => {
  it('converte UTC para o horário de Brasília', () => {
    // O caso real: check-in gravado às 19:13 UTC.
    expect(formatarDataHoraBR('2026-09-24T19:13:14+00:00')).toBe('24/09/2026, 16:13')
  })

  it('vira o dia quando o horário UTC é de madrugada', () => {
    // 01:30 UTC ainda é o dia anterior aqui — o erro de um dia que aparecia
    // nos check-ins de eventos noturnos.
    expect(formatarDataHoraBR('2026-09-25T01:30:00+00:00')).toBe('24/09/2026, 22:30')
  })

  it('aceita o sufixo Z', () => {
    expect(formatarDataHoraBR('2026-09-24T19:13:14Z')).toBe('24/09/2026, 16:13')
  })

  it('devolve vazio para ausente ou inválido', () => {
    expect(formatarDataHoraBR(null)).toBe('')
    expect(formatarDataHoraBR(undefined)).toBe('')
    expect(formatarDataHoraBR('')).toBe('')
    expect(formatarDataHoraBR('não é data')).toBe('')
  })
})

describe('formatarHoraBR', () => {
  it('mostra só a hora, em Brasília', () => {
    expect(formatarHoraBR('2026-09-24T19:13:14+00:00')).toBe('16:13')
  })

  it('devolve vazio para ausente', () => {
    expect(formatarHoraBR(null)).toBe('')
  })
})

describe('formatarDataBR', () => {
  it('usa o dia de calendário de Brasília, não o de UTC', () => {
    expect(formatarDataBR('2026-09-25T01:30:00+00:00')).toBe('24/09/2026')
  })
})

describe('formatarDataPura', () => {
  it('formata a coluna date sem deslocar o dia', () => {
    // `new Date('2026-09-26')` é meia-noite UTC; formatado em Brasília viraria
    // 25/09. Por isso esta função não passa por Date.
    expect(formatarDataPura('2026-09-26')).toBe('26/09/2026')
  })

  it('ignora o que vier depois da data', () => {
    expect(formatarDataPura('2026-03-21T00:00:00+00:00')).toBe('21/03/2026')
  })

  it('devolve vazio para ausente ou fora do formato', () => {
    expect(formatarDataPura(null)).toBe('')
    expect(formatarDataPura('21/03/2026')).toBe('')
  })
})
