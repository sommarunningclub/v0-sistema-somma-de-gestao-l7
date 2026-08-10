import { sanitizeCampaignHtml, renderHtmlCustom } from '../html-custom'

const UNSUB = 'https://admin.sommaclub.com.br/api/unsubscribe?t=abc'

describe('sanitizeCampaignHtml', () => {
  it('remove script', () => {
    const out = sanitizeCampaignHtml('<p>ok</p><script>alert(1)</script>')
    expect(out).toContain('ok')
    expect(out).not.toContain('alert(1)')
    expect(out.toLowerCase()).not.toContain('<script')
  })

  it('remove iframe, form, object e embed', () => {
    const out = sanitizeCampaignHtml(
      '<iframe src="x"></iframe><form></form><object></object><embed />',
    )
    expect(out.toLowerCase()).not.toContain('<iframe')
    expect(out.toLowerCase()).not.toContain('<form')
    expect(out.toLowerCase()).not.toContain('<object')
    expect(out.toLowerCase()).not.toContain('<embed')
  })

  it('remove atributos de evento', () => {
    const out = sanitizeCampaignHtml('<p onclick="alert(1)">oi</p>')
    expect(out).not.toContain('onclick')
  })

  it('remove href com esquema javascript', () => {
    const out = sanitizeCampaignHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('preserva href http e https', () => {
    const out = sanitizeCampaignHtml('<a href="https://ok.com">x</a>')
    expect(out).toContain('https://ok.com')
  })

  it('preserva a formatação típica de e-mail', () => {
    const raw =
      '<table role="presentation"><tr><td style="color:#fff">oi</td></tr></table><img src="https://x/y.png" />'
    const out = sanitizeCampaignHtml(raw)
    expect(out).toContain('<table')
    expect(out).toContain('style=')
    expect(out).toContain('<img')
  })
})

describe('renderHtmlCustom', () => {
  const base = { html: '<body><p>Oi {{nome}}</p></body>', nome: 'Ana', unsubscribeUrl: UNSUB }

  it('injeta o link de descadastro', () => {
    expect(renderHtmlCustom(base)).toContain(UNSUB)
  })

  it('injeta o descadastro mesmo sem body', () => {
    const out = renderHtmlCustom({ ...base, html: '<p>sem body</p>' })
    expect(out).toContain(UNSUB)
  })

  it('substitui {{nome}} sem escapar o resto do documento', () => {
    const out = renderHtmlCustom(base)
    expect(out).toContain('Oi Ana')
    expect(out).toContain('<p>')
  })

  it('escapa o nome do destinatário', () => {
    const out = renderHtmlCustom({ ...base, nome: '<b>Ana</b>' })
    expect(out).not.toContain('<b>Ana</b>')
    expect(out).toContain('&lt;b&gt;Ana&lt;/b&gt;')
  })

  it('usa string vazia quando não há nome', () => {
    const out = renderHtmlCustom({ ...base, nome: null })
    expect(out).toContain('Oi ')
    expect(out).not.toContain('{{nome}}')
    expect(out).not.toContain('null')
  })

  it('injeta o preheader quando existe', () => {
    const out = renderHtmlCustom({ ...base, preheader: 'Prévia da caixa' })
    expect(out).toContain('Prévia da caixa')
  })

  it('sanitiza o html recebido', () => {
    const out = renderHtmlCustom({ ...base, html: '<p>ok</p><script>alert(1)</script>' })
    expect(out).not.toContain('alert(1)')
  })
})
