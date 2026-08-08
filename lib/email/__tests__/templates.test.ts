import { escapeHtml, renderTemplate, TEMPLATE_KEYS } from '../templates'

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
  it('exposes the three templates', () => {
    expect(TEMPLATE_KEYS).toEqual(['anuncio', 'simples', 'evento'])
  })

  it.each(TEMPLATE_KEYS)('renders %s with the CTA and the unsubscribe link', (templateKey) => {
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
