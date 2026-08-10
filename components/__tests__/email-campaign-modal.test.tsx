import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import EmailCampaignModal from '../email-campaign-modal'
import type { AudienceSelection } from '@/lib/email/types'

// O picker real dispara chamadas de rede e é coberto pelos próprios testes
// dele (`email-audience-picker.test.tsx`). Aqui só precisamos de um jeito
// determinístico de simular "usuário selecionou 1 individual, nenhuma base".
jest.mock('../email-audience-picker', () => {
  return function MockEmailAudiencePicker({
    value,
    onChange,
  }: {
    value: AudienceSelection
    onChange: (next: AudienceSelection) => void
  }) {
    return (
      <button
        type="button"
        data-testid="add-individual"
        onClick={() =>
          onChange({
            ...value,
            bases: [],
            individuais: [{ email: 'pessoa@x.com', nome: null }],
          })
        }
      >
        Adicionar individual
      </button>
    )
  }
})

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))

// `ResponsiveModal` usa `useIsMobile`, que depende de `window.matchMedia`
// (não implementado no jsdom padrão). Sem esse stub, todo teste que monta o
// modal quebra antes de chegar à asserção — nada a ver com C1/C2.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
})

describe('EmailCampaignModal — gate do passo 1 (audiência)', () => {
  it('mantém "Próximo" desabilitado sem base e sem individual', () => {
    render(<EmailCampaignModal onClose={jest.fn()} onSaved={jest.fn()} />)
    const nextButton = screen.getByRole('button', { name: /Próximo/i })
    expect(nextButton).toBeDisabled()
  })

  it('habilita "Próximo" quando há ao menos um individual, mesmo com bases vazias', () => {
    render(<EmailCampaignModal onClose={jest.fn()} onSaved={jest.fn()} />)

    fireEvent.click(screen.getByTestId('add-individual'))

    const nextButton = screen.getByRole('button', { name: /Próximo/i })
    expect(nextButton).not.toBeDisabled()
  })

  it('avança para o passo 2 (goToStep2) com individual selecionado e nenhuma base', () => {
    render(<EmailCampaignModal onClose={jest.fn()} onSaved={jest.fn()} />)

    fireEvent.click(screen.getByTestId('add-individual'))
    fireEvent.click(screen.getByRole('button', { name: /Próximo/i }))

    // Passo 2 não renderiza mais o picker de audiência (mockado) — só o de
    // conteúdo. Se `goToStep2` tivesse retornado cedo, o mock continuaria na tela.
    expect(screen.queryByTestId('add-individual')).not.toBeInTheDocument()
  })
})
