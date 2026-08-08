import React from 'react'
import { render, screen } from '@testing-library/react'
import EmailContentForm from '../email-content-form'

const baseProps = {
  nome: '',
  onNomeChange: jest.fn(),
  subject: '',
  onSubjectChange: jest.fn(),
  preheader: '',
  onPreheaderChange: jest.fn(),
  content: { titulo: '', texto: '' },
  onContentChange: jest.fn(),
  ctaLabel: '',
  onCtaLabelChange: jest.fn(),
  ctaUrl: '',
  onCtaUrlChange: jest.fn(),
  onSaveDraft: jest.fn(),
  saving: false,
  saveError: null,
}

describe('EmailContentForm', () => {
  it('sem preview salvo, mostra o placeholder e não renderiza iframe', () => {
    render(
      <EmailContentForm {...baseProps} templateKey="simples" onTemplateKeyChange={jest.fn()} previewHtml={null} />,
    )
    expect(screen.getByText(/Salve o rascunho para ver o preview/)).toBeTruthy()
    expect(screen.queryByTitle('Preview do e-mail')).toBeNull()
  })

  it('com preview salvo, renderiza o iframe com o HTML retornado pela API', () => {
    render(
      <EmailContentForm
        {...baseProps}
        templateKey="simples"
        onTemplateKeyChange={jest.fn()}
        previewHtml="<html><body>Oi</body></html>"
      />,
    )
    const iframe = screen.getByTitle('Preview do e-mail') as HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('srcdoc')).toContain('Oi')
  })

  it('template "simples" esconde o campo de imagem; "anuncio" mostra', () => {
    const { rerender } = render(
      <EmailContentForm {...baseProps} templateKey="simples" onTemplateKeyChange={jest.fn()} previewHtml={null} />,
    )
    expect(screen.queryByText('URL da imagem')).toBeNull()

    rerender(
      <EmailContentForm {...baseProps} templateKey="anuncio" onTemplateKeyChange={jest.fn()} previewHtml={null} />,
    )
    expect(screen.getByText('URL da imagem')).toBeTruthy()
  })

  it('template "evento" mostra data, local e imagem', () => {
    render(
      <EmailContentForm {...baseProps} templateKey="evento" onTemplateKeyChange={jest.fn()} previewHtml={null} />,
    )
    expect(screen.getByText('URL da imagem')).toBeTruthy()
    expect(screen.getByText('Data')).toBeTruthy()
    expect(screen.getByText('Local')).toBeTruthy()
  })
})
