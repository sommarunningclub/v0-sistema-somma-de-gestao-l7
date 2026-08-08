import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import EmailAudiencePicker from '../email-audience-picker'
import { apiFetch } from '@/lib/api-client'
import type { AudienceSelection } from '@/lib/email/types'

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const SOURCES = [
  { key: 'membros', label: 'Membros do clube', table: 'cadastro_site', emailCol: 'email', nameCol: 'nome_completo', filters: [] },
  {
    key: 'checkins',
    label: 'Check-ins de eventos',
    table: 'checkins',
    emailCol: 'email',
    nameCol: 'nome_completo',
    filters: [
      { key: 'pelotao', label: 'Pelotão', kind: 'text' },
      {
        key: 'sexo',
        label: 'Sexo',
        kind: 'select',
        options: [
          { value: 'M', label: 'Masculino' },
          { value: 'F', label: 'Feminino' },
        ],
      },
    ],
  },
]

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setupFetchMock() {
  mockedApiFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === '/api/email-audiences/preview' && method === 'GET') {
      return jsonResponse({ sources: SOURCES })
    }
    if (url === '/api/eventos/ativos') {
      return jsonResponse({ proximos_eventos: [], historico: [] })
    }
    if (url === '/api/email-audiences/preview' && method === 'POST') {
      const body = JSON.parse(String(init?.body ?? '{}')) as AudienceSelection
      const porBase: Record<string, number> = {}
      for (const b of body.bases) porBase[b.key] = 7
      return jsonResponse({ total: body.bases.length * 7, porBase })
    }
    throw new Error(`unexpected apiFetch call: ${method} ${url}`)
  })
}

beforeEach(() => {
  jest.useFakeTimers({ legacyFakeTimers: false })
  setupFetchMock()
})

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

describe('EmailAudiencePicker', () => {
  it('carrega e lista as bases retornadas pelo GET de preview', async () => {
    render(<EmailAudiencePicker value={{ bases: [] }} onChange={jest.fn()} />)

    await waitFor(() => expect(screen.getByText('Membros do clube')).toBeTruthy())
    expect(screen.getByText('Check-ins de eventos')).toBeTruthy()
    // Nenhuma base selecionada: sem filtros visíveis e sem chamada de preview ao vivo.
    expect(screen.queryByText('Pelotão')).toBeNull()
    expect(screen.getByText(/destinatários únicos/)).toBeTruthy()
  })

  it('ao marcar uma base, chama onChange e depois de 500ms busca a contagem ao vivo', async () => {
    const onChange = jest.fn()

    const { rerender } = render(<EmailAudiencePicker value={{ bases: [] }} onChange={onChange} />)
    await waitFor(() => expect(screen.getByText('Membros do clube')).toBeTruthy())

    const checkbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(checkbox)

    expect(onChange).toHaveBeenCalledWith({ bases: [{ key: 'membros', filtros: {} }] })

    // O componente é semi-controlado: o pai precisa devolver o novo `value`
    // para a contagem ao vivo (que depende de `value`) recalcular.
    rerender(<EmailAudiencePicker value={{ bases: [{ key: 'membros', filtros: {} }] }} onChange={onChange} />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => expect(screen.getByText('7 destinatários únicos')).toBeTruthy())
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/api/email-audiences/preview',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('ao desmarcar a última base antes do debounce disparar, não trava em "Calculando..."', async () => {
    const onChange = jest.fn()

    const { rerender } = render(<EmailAudiencePicker value={{ bases: [] }} onChange={onChange} />)
    await waitFor(() => expect(screen.getByText('Membros do clube')).toBeTruthy())

    // Seleciona a base — dispara o debounce (previewLoading = true) — e desmarca
    // de novo antes dos 500ms, tudo dentro do mesmo re-render controlado pelo pai.
    rerender(<EmailAudiencePicker value={{ bases: [{ key: 'membros', filtros: {} }] }} onChange={onChange} />)
    rerender(<EmailAudiencePicker value={{ bases: [] }} onChange={onChange} />)

    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    // Nenhuma chamada POST deveria ter ocorrido (debounce cancelado), e o
    // texto precisa refletir "0 destinatários", nunca ficar preso em
    // "Calculando..." (regressão: faltava um `setPreviewLoading(false)` no
    // early-return de bases vazias).
    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      '/api/email-audiences/preview',
      expect.objectContaining({ method: 'POST' }),
    )
    await waitFor(() => expect(screen.getByText('0 destinatários únicos')).toBeTruthy())
    expect(screen.queryByText('Calculando...')).toBeNull()
  })

  it('descarta resposta de preview desatualizada que chegue fora de ordem', async () => {
    const onChange = jest.fn()
    const deferreds: Array<ReturnType<typeof createDeferred<Response>>> = []

    // Substitui o mock padrão: GET continua respondendo na hora, mas o POST
    // de preview devolve uma promise controlada manualmente pelo teste, para
    // simular duas requisições em voo ao mesmo tempo, resolvidas fora de ordem.
    mockedApiFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url === '/api/email-audiences/preview' && method === 'GET') return jsonResponse({ sources: SOURCES })
      if (url === '/api/eventos/ativos') return jsonResponse({ proximos_eventos: [], historico: [] })
      if (url === '/api/email-audiences/preview' && method === 'POST') {
        const deferred = createDeferred<Response>()
        deferreds.push(deferred)
        return deferred.promise
      }
      throw new Error(`unexpected apiFetch call: ${method} ${url}`)
    })

    const { rerender } = render(<EmailAudiencePicker value={{ bases: [] }} onChange={onChange} />)
    await waitFor(() => expect(screen.getByText('Membros do clube')).toBeTruthy())

    // Requisição 1 (vai ficar "mais lenta"): só a base "membros".
    rerender(<EmailAudiencePicker value={{ bases: [{ key: 'membros', filtros: {} }] }} onChange={onChange} />)
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    // Requisição 2 (a mais recente): "membros" + "checkins".
    rerender(
      <EmailAudiencePicker
        value={{ bases: [{ key: 'membros', filtros: {} }, { key: 'checkins', filtros: {} }] }}
        onChange={onChange}
      />,
    )
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(deferreds).toHaveLength(2)

    // Resolve a requisição 2 (mais recente) primeiro, e só depois a 1
    // (desatualizada) — exatamente o cenário de corrida da revisão.
    await act(async () => {
      deferreds[1].resolve(jsonResponse({ total: 14, porBase: { membros: 7, checkins: 7 } }))
    })
    await waitFor(() => expect(screen.getByText('14 destinatários únicos')).toBeTruthy())

    await act(async () => {
      deferreds[0].resolve(jsonResponse({ total: 7, porBase: { membros: 7 } }))
    })

    // A resposta desatualizada não pode sobrescrever o resultado correto,
    // mesmo chegando depois.
    expect(screen.getByText('14 destinatários únicos')).toBeTruthy()
    expect(screen.queryByText('7 destinatários únicos')).toBeNull()
  })

  it('expande os filtros declarados quando a base com filtros é selecionada', async () => {
    const onChange = jest.fn()
    render(
      <EmailAudiencePicker
        value={{ bases: [{ key: 'checkins', filtros: {} }] }}
        onChange={onChange}
      />,
    )

    await waitFor(() => expect(screen.getByText('Pelotão')).toBeTruthy())
    expect(screen.getByText('Sexo')).toBeTruthy()
  })
})
