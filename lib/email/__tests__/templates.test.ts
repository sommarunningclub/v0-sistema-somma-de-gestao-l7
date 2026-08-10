import { escapeHtml, renderTemplate, TEMPLATE_KEYS } from '../templates'

const RENDERED_TEMPLATE_KEYS = ['anuncio', 'simples', 'evento'] as const

const base = {
  subject: 'Assunto',
  preheader: 'Prévia',
  content: { titulo: 'Título', texto: 'Primeira linha.\n\nSegunda linha.' },
  ctaLabel: 'Quero participar',
  ctaUrl: 'https://sommaclub.com.br/evento',
  nome: 'Ana',
  unsubscribeUrl: 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc',
}

describe('escapeHtml', () => {
  it('escapes the dangerous characters', () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;',
    )
  })
})

describe('renderTemplate', () => {
  it('exposes the four templates', () => {
    expect(TEMPLATE_KEYS).toEqual(['anuncio', 'simples', 'evento', 'html_custom'])
  })

  it.each(RENDERED_TEMPLATE_KEYS)('renders %s with the CTA and the unsubscribe link', (templateKey) => {
    const html = renderTemplate({ ...base, templateKey })

    expect(html).toContain('Quero participar')
    expect(html).toContain('https://sommaclub.com.br/evento')
    expect(html).toContain(base.unsubscribeUrl)
    expect(html).toContain('Título')
    expect(html).toContain('Prévia')
  })

  it('interpolates {{nome}}', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      content: { titulo: 'Oi {{nome}}', texto: 'Tudo bem, {{nome}}?' },
    })
    expect(html).toContain('Oi Ana')
    expect(html).toContain('Tudo bem, Ana?')
    expect(html).not.toContain('{{nome}}')
  })

  it('falls back when nome is null', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      nome: null,
      content: { titulo: 'Oi {{nome}}', texto: 'texto' },
    })
    expect(html).toContain('Oi ')
    expect(html).not.toContain('{{nome}}')
    expect(html).not.toContain('null')
  })

  it('escapes user content', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      content: { titulo: '<script>alert(1)</script>', texto: 'ok' },
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes the name too', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'simples',
      nome: '<b>Ana</b>',
      content: { titulo: 'Oi {{nome}}', texto: 'ok' },
    })
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
  })

  it('turns blank lines into paragraphs', () => {
    const html = renderTemplate({ ...base, templateKey: 'simples' })
    expect(html).toContain('Primeira linha.')
    expect(html).toContain('Segunda linha.')
    expect((html.match(/<p /g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('omits the CTA when label or url is missing', () => {
    const semLabel = renderTemplate({ ...base, templateKey: 'simples', ctaLabel: null })
    expect(semLabel).not.toContain('https://sommaclub.com.br/evento')

    const semUrl = renderTemplate({ ...base, templateKey: 'simples', ctaUrl: null })
    expect(semUrl).not.toContain('Quero participar')
  })

  it('renders the image only on templates that support it', () => {
    const content = { titulo: 'T', texto: 'x', imagem_url: 'https://cdn.x/img.png' }
    expect(renderTemplate({ ...base, templateKey: 'anuncio', content })).toContain('https://cdn.x/img.png')
    expect(renderTemplate({ ...base, templateKey: 'simples', content })).not.toContain('https://cdn.x/img.png')
  })

  it('renders date and place on the evento template', () => {
    const html = renderTemplate({
      ...base,
      templateKey: 'evento',
      content: { titulo: 'T', texto: 'x', data: '12/09 às 7h', local: 'Parque da Cidade' },
    })
    expect(html).toContain('12/09 às 7h')
    expect(html).toContain('Parque da Cidade')
  })

  it('always produces a full html document', () => {
    const html = renderTemplate({ ...base, templateKey: 'anuncio' })
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(html).toContain('</html>')
  })
})

describe('renderTemplate com html_custom', () => {
  const base = {
    templateKey: 'html_custom' as const,
    subject: 'Assunto',
    preheader: 'Prévia',
    content: { titulo: '', texto: '', html: '<body><p>Oi {{nome}}</p></body>' },
    ctaLabel: null,
    ctaUrl: null,
    nome: 'Ana',
    unsubscribeUrl: 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc',
  }

  it('expõe html_custom entre os templates', () => {
    expect(TEMPLATE_KEYS).toContain('html_custom')
  })

  it('usa o html do usuário como corpo', () => {
    expect(renderTemplate(base)).toContain('Oi Ana')
  })

  it('injeta o link de descadastro', () => {
    expect(renderTemplate(base)).toContain('/api/unsubscribe?t=abc')
  })

  it('sanitiza o html', () => {
    const out = renderTemplate({
      ...base,
      content: { titulo: '', texto: '', html: '<p>ok</p><script>alert(1)</script>' },
    })
    expect(out).not.toContain('alert(1)')
  })

  it('não envolve no documento padrão dos outros templates', () => {
    const out = renderTemplate(base)
    expect((out.match(/<body/gi) ?? []).length).toBeLessThanOrEqual(1)
  })
})
