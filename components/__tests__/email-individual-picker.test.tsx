import { render, screen, fireEvent, act } from '@testing-library/react'
import { EmailIndividualPicker } from '../email-individual-picker'

jest.mock('@/lib/api-client', () => ({
  apiFetch: jest.fn(),
}))
const { apiFetch } = jest.requireMock('@/lib/api-client')

function respondWith(data: Array<{ nome: string | null; email: string }>) {
  ;(apiFetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  })
}

beforeEach(() => {
  jest.useFakeTimers()
  ;(apiFetch as jest.Mock).mockReset()
})
afterEach(() => jest.useRealTimers())

describe('EmailIndividualPicker', () => {
  it('mostra os escolhidos como fichas', () => {
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={() => {}}
      />,
    )
    expect(screen.getByText(/ana@x\.com/)).toBeInTheDocument()
  })

  it('remove um escolhido ao clicar no botão de remover', () => {
    const onChange = jest.fn()
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remover/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('busca depois do debounce e lista sugestões', async () => {
    respondWith([{ nome: 'Ana Souza', email: 'ana@x.com' }])
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
  })

  it('não busca com menos de 2 caracteres', async () => {
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('oferece adicionar um e-mail digitado que não está na base', async () => {
    respondWith([])
    render(<EmailIndividualPicker value={[]} onChange={() => {}} />)

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'novo@exemplo.com' },
    })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })

    expect(await screen.findByText(/novo@exemplo\.com/)).toBeInTheDocument()
  })

  it('não duplica quem já foi escolhido', async () => {
    respondWith([{ nome: 'Ana', email: 'ana@x.com' }])
    const onChange = jest.fn()
    render(
      <EmailIndividualPicker
        value={[{ email: 'ana@x.com', nome: 'Ana' }]}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ana' } })
    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    const sugestao = screen.queryByRole('button', { name: /Ana Souza/i })
    expect(sugestao).toBeNull()
  })
})
