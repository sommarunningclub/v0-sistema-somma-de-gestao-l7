import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { TarefasFiltersProvider, useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { TarefasFiltersFields } from '../tarefas-filters-panel'
import type { TarefasColumn, TarefasUser } from '@/lib/services/tarefas'

/**
 * `TarefasFiltersFields` é o bloco de filtros que o módulo Tarefas realmente
 * renderiza — na barra lateral do desktop e dentro do bottom sheet no celular.
 *
 * Os testes anteriores cobriam dois wrappers (`TarefasFiltersPanel` e
 * `TarefasFiltersPanelMobile`) que deixaram de ser usados no redesign, e várias
 * asserções eram vazias (`expect(document.body).toBeTruthy()`), passando
 * independentemente do comportamento. Aqui cada caso verifica o estado do
 * filtro de fato.
 */

jest.mock('@/lib/services/tarefas', () => ({
  getTeamUsers: jest.fn(() =>
    Promise.resolve([
      { id: 'user-1', full_name: 'John Doe', email: 'john@example.com' },
      { id: 'user-2', full_name: 'Jane Smith', email: 'jane@example.com' },
    ]),
  ),
}))

const mockColumns: TarefasColumn[] = [
  { id: 'col-1', board_id: 'board-1', nome: 'A Fazer', cor: '#3b82f6', posicao: 0, criado_por: 'user-1', criado_em: '2026-03-18T00:00:00Z' },
  { id: 'col-2', board_id: 'board-1', nome: 'Em Progresso', cor: '#f59e0b', posicao: 1, criado_por: 'user-1', criado_em: '2026-03-18T00:00:00Z' },
]

const mockUsers: TarefasUser[] = [
  { id: 'user-1', full_name: 'John Doe', email: 'john@example.com' },
  { id: 'user-2', full_name: 'Jane Smith', email: 'jane@example.com' },
] as TarefasUser[]

/** Expõe o estado do contexto para as asserções. */
let ultimoEstado: ReturnType<typeof useTarefasFilters> | null = null

function Espiao() {
  ultimoEstado = useTarefasFilters()
  return null
}

function renderFields(props: Partial<React.ComponentProps<typeof TarefasFiltersFields>> = {}) {
  return render(
    <TarefasFiltersProvider>
      <Espiao />
      <TarefasFiltersFields columns={mockColumns} users={mockUsers} {...props} />
    </TarefasFiltersProvider>,
  )
}

/** Encontra o checkbox cujo rótulo contém o texto dado. */
function checkboxPorRotulo(texto: string | RegExp): HTMLInputElement {
  const rotulo = screen.getByText(texto).closest('label')
  if (!rotulo) throw new Error(`Rótulo não encontrado para: ${texto}`)
  return within(rotulo).getByRole('checkbox') as HTMLInputElement
}

beforeEach(() => {
  ultimoEstado = null
  // O contexto persiste os filtros em localStorage, que o jsdom compartilha
  // entre os testes do arquivo. Sem limpar, um teste herda a seleção do
  // anterior e as asserções de estado inicial passam a mentir.
  window.localStorage.clear()
})

describe('TarefasFiltersFields', () => {
  it('renderiza uma seção para cada critério de filtro', () => {
    renderFields()

    for (const titulo of ['Prioridade', 'Status', 'Responsável', 'Coluna', 'Data de Entrega']) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
  })

  it('usa headings de nível 3, preservando a hierarquia da página', () => {
    renderFields()

    const headings = screen.getAllByRole('heading', { level: 3 })
    expect(headings.length).toBeGreaterThanOrEqual(5)
  })

  it('marca e desmarca uma prioridade, refletindo no estado do filtro', () => {
    renderFields()

    const alta = checkboxPorRotulo('Alta')
    expect(alta.checked).toBe(false)

    fireEvent.click(alta)
    expect(ultimoEstado?.filters.priorities).toContain('alta')

    fireEvent.click(alta)
    expect(ultimoEstado?.filters.priorities).not.toContain('alta')
  })

  it('acumula múltiplos status selecionados', () => {
    renderFields()

    fireEvent.click(checkboxPorRotulo('Pendente'))
    fireEvent.click(checkboxPorRotulo('Concluída'))

    expect(ultimoEstado?.filters.statuses).toEqual(
      expect.arrayContaining(['pending', 'completed']),
    )
  })

  it('filtra por coluna usando o id, não o nome', () => {
    renderFields()

    fireEvent.click(checkboxPorRotulo('Em Progresso'))
    expect(ultimoEstado?.filters.columnIds).toEqual(['col-2'])
  })

  it('filtra por responsável', async () => {
    renderFields()

    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument())
    fireEvent.click(checkboxPorRotulo('Jane Smith'))

    expect(ultimoEstado?.filters.responsavelIds).toEqual(['user-2'])
  })

  it('define o intervalo de datas pelos campos De e Até', () => {
    renderFields()

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2026-08-31' } })

    expect(ultimoEstado?.filters.dateRange).toEqual({ start: '2026-08-01', end: '2026-08-31' })
  })

  it('limpar um campo de data volta o valor para null, não para string vazia', () => {
    renderFields()

    const de = screen.getByLabelText('De')
    fireEvent.change(de, { target: { value: '2026-08-01' } })
    fireEvent.change(de, { target: { value: '' } })

    expect(ultimoEstado?.filters.dateRange.start).toBeNull()
  })

  it('avisa o consumidor a cada mudança de filtro', () => {
    const onFiltersChange = jest.fn()
    renderFields({ onFiltersChange })

    fireEvent.click(checkboxPorRotulo('Alta'))
    expect(onFiltersChange).toHaveBeenCalledTimes(1)

    fireEvent.click(checkboxPorRotulo('Pendente'))
    expect(onFiltersChange).toHaveBeenCalledTimes(2)
  })

  it('sinaliza que há filtros ativos', () => {
    renderFields()

    expect(ultimoEstado?.hasActiveFilters).toBe(false)
    fireEvent.click(checkboxPorRotulo('Alta'))
    expect(ultimoEstado?.hasActiveFilters).toBe(true)
  })

  it('explica a ausência de colunas em vez de mostrar uma seção vazia', () => {
    renderFields({ columns: [] })

    expect(screen.getByText('Este quadro ainda não tem colunas.')).toBeInTheDocument()
  })

  it('explica a ausência de usuários em vez de mostrar uma seção vazia', () => {
    renderFields({ users: [] })

    expect(screen.getByText('Nenhum usuário disponível.')).toBeInTheDocument()
  })

  it('dá aos rótulos de filtro um alvo de toque confortável', () => {
    const { container } = renderFields()

    const rotulos = container.querySelectorAll('label.min-h-\\[44px\\]')
    expect(rotulos.length).toBeGreaterThan(0)
  })
})
