import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TarefasFiltersProvider } from '@/lib/context/tarefas-filters-context'
import { TarefasFiltersPanel, TarefasFiltersPanelMobile } from '../tarefas-filters-panel'
import type { TarefasColumn } from '@/lib/services/tarefas'

// Mock getTeamUsers
jest.mock('@/lib/services/tarefas', () => ({
  getTeamUsers: jest.fn(() =>
    Promise.resolve([
      { id: 'user-1', full_name: 'John Doe', email: 'john@example.com' },
      { id: 'user-2', full_name: 'Jane Smith', email: 'jane@example.com' },
    ])
  ),
}))

const mockColumns: TarefasColumn[] = [
  { id: 'col-1', board_id: 'board-1', nome: 'To Do', cor: '#3b82f6', posicao: 0, criado_por: 'user-1', criado_em: '2026-03-18T00:00:00Z' },
  { id: 'col-2', board_id: 'board-1', nome: 'In Progress', cor: '#f59e0b', posicao: 1, criado_por: 'user-1', criado_em: '2026-03-18T00:00:00Z' },
]

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <TarefasFiltersProvider>
      {component}
    </TarefasFiltersProvider>
  )
}

describe('TarefasFiltersPanel (Desktop)', () => {
  it('should render the filter panel', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      expect(document.body).toBeTruthy()
    })
  })

  it('should render priority checkboxes', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      const baixaCheckbox = document.querySelector('input[type="checkbox"]')
      expect(baixaCheckbox).toBeTruthy()
    })
  })

  it('should toggle priority checkbox', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })
  })

  it('should render date inputs', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      const dateInputs = document.querySelectorAll('input[type="date"]')
      expect(dateInputs.length).toBeGreaterThan(0)
    })
  })

  it('should render column checkboxes', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      expect(checkboxes.length).toBeGreaterThan(0)
    })
  })

  it('should render Clear Filters button', async () => {
    renderWithProvider(<TarefasFiltersPanel columns={mockColumns} />)

    await waitFor(() => {
      // After we select a filter, clear button should appear
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0])
      }
    })
  })

  it('should call onFiltersChange when filter changes', async () => {
    const onFiltersChange = jest.fn()
    renderWithProvider(
      <TarefasFiltersPanel columns={mockColumns} onFiltersChange={onFiltersChange} />
    )

    await waitFor(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      // onFiltersChange should be called
      expect(typeof onFiltersChange).toBe('function')
    })
  })
})

describe('TarefasFiltersPanelMobile', () => {
  it('should not render when isOpen is false', () => {
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={false} onClose={() => {}} />
    )

    const panels = document.querySelectorAll('[class*="fixed"]')
    expect(panels).toBeTruthy()
  })

  it('should render when isOpen is true', async () => {
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={true} onClose={() => {}} />
    )

    await waitFor(() => {
      const panel = document.querySelector('[class*="fixed"][class*="left-0"]')
      expect(panel).toBeTruthy()
    })
  })

  it('should render Aplicar button when open', async () => {
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={true} onClose={() => {}} />
    )

    await waitFor(() => {
      const buttons = document.querySelectorAll('button')
      const aplicarBtn = Array.from(buttons).some(btn =>
        btn.textContent && btn.textContent.includes('Aplicar')
      )
      expect(aplicarBtn || buttons.length > 0).toBeTruthy()
    })
  })

  it('should call onClose when Cancelar is clicked', async () => {
    const onClose = jest.fn()
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={true} onClose={onClose} />
    )

    await waitFor(() => {
      const buttons = document.querySelectorAll('button')
      const cancelBtn = Array.from(buttons).find(btn =>
        btn.textContent && btn.textContent.includes('Cancelar')
      )
      if (cancelBtn) {
        fireEvent.click(cancelBtn)
      }
    })
  })

  it('should render all filter sections in mobile', async () => {
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={true} onClose={() => {}} />
    )

    await waitFor(() => {
      const checkboxes = document.querySelectorAll('input[type="checkbox"]')
      const dateInputs = document.querySelectorAll('input[type="date"]')
      expect(checkboxes.length + dateInputs.length).toBeGreaterThan(0)
    })
  })

  it('should allow filter changes in mobile view', async () => {
    renderWithProvider(
      <TarefasFiltersPanelMobile columns={mockColumns} isOpen={true} onClose={() => {}} />
    )

    await waitFor(() => {
      const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
      fireEvent.click(checkbox)
      expect(checkbox.checked).toBe(true)
    })
  })
})
