import sanitizeHtml from 'sanitize-html'
import { escapeHtml, footer, preheaderBlock } from './templates/shared'

/**
 * Sanitiza o HTML enviado pelo usuário.
 *
 * Os templates do módulo escapam todo conteúdo do usuário; aceitar HTML
 * arbitrário remove essa garantia inteira. Como o domínio de envio é
 * compartilhado com o 1-ano-SommaDay, um script ou pixel de terceiro num
 * e-mail nosso afeta a reputação dos dois sistemas — por isso a lista é
 * branca (o que não está previsto, sai), não negra.
 */
export function sanitizeCampaignHtml(raw: string): string {
  return sanitizeHtml(raw, {
    allowedTags: [
      'html', 'head', 'body', 'meta', 'title', 'style',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      'div', 'span', 'p', 'a', 'img', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'b', 'em', 'i', 'u', 'small',
      'ul', 'ol', 'li', 'blockquote', 'center', 'font',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'valign', 'width', 'height', 'bgcolor', 'dir', 'lang'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'border'],
      table: ['role', 'cellpadding', 'cellspacing', 'border'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      meta: ['charset', 'name', 'content'],
    },
    // Só esquemas que fazem sentido num e-mail. `javascript:` fica de fora.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    allowProtocolRelative: false,
    // `style` é indispensável em e-mail (todo CSS é inline), mas <style> com
    // conteúdo hostil não é — o sanitizador já remove o que não for CSS.
    allowedStyles: {},
    // A tag <style> (bloco, não atributo) é necessária para @media queries
    // responsivas em e-mail — sem ela, templates com breakpoint mobile
    // quebram. `sanitize-html` marca isso como "vulnerable" porque o
    // conteúdo de <style> não é parseado como CSS (podendo conter
    // `expression()`/`@import` hostil); aceitamos o risco de propósito,
    // documentado aqui, porque é indispensável para a formatação de e-mail.
    allowVulnerableTags: true,
  })
}

interface RenderHtmlCustomArgs {
  html: string
  nome: string | null
  preheader?: string | null
  unsubscribeUrl: string
}

/**
 * Monta o corpo final de uma campanha com HTML próprio.
 *
 * O rodapé de descadastro é injetado por cima do HTML do usuário, sempre —
 * é exigência de LGPD e não pode depender de o autor do arquivo ter lembrado.
 */
export function renderHtmlCustom({
  html,
  nome,
  preheader,
  unsubscribeUrl,
}: RenderHtmlCustomArgs): string {
  let out = sanitizeCampaignHtml(html)

  // Diferente do `interpolate` dos outros templates, aqui só o NOME é escapado
  // — escapar o documento inteiro destruiria o HTML do usuário.
  const safeNome = nome ? escapeHtml(nome) : ''
  out = out.replace(/\{\{\s*nome\s*\}\}/g, () => safeNome)

  if (preheader) {
    const block = preheaderBlock(preheader)
    out = out.includes('<body')
      ? out.replace(/(<body[^>]*>)/i, `$1${block}`)
      : block + out
  }

  const rodape = footer(unsubscribeUrl)
  out = out.includes('</body>') ? out.replace(/<\/body>/i, `${rodape}</body>`) : out + rodape

  return out
}
