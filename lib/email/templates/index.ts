import {
  COLORS,
  ctaButton,
  document,
  escapeHtml,
  footer,
  heroImage,
  interpolate,
  paragraphs,
  preheaderBlock,
} from './shared'

export { escapeHtml }

export const TEMPLATE_KEYS = ['anuncio', 'simples', 'evento'] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export interface TemplateFields {
  titulo: string
  texto: string
  imagem_url?: string
  data?: string
  local?: string
}

export interface RenderArgs {
  templateKey: TemplateKey
  subject: string
  preheader?: string | null
  content: TemplateFields
  ctaLabel?: string | null
  ctaUrl?: string | null
  nome: string | null
  unsubscribeUrl: string
}

function title(text: string, nome: string | null): string {
  return `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:${COLORS.black};">${interpolate(text, nome)}</h1>`
}

function metaRow(label: string, value: string | undefined): string {
  if (!value) return ''
  return `<tr>
    <td style="padding:4px 12px 4px 0;font-size:14px;color:${COLORS.gray};">${escapeHtml(label)}</td>
    <td style="padding:4px 0;font-size:14px;font-weight:700;color:${COLORS.black};">${escapeHtml(value)}</td>
  </tr>`
}

export function renderTemplate(args: RenderArgs): string {
  const { templateKey, subject, preheader, content, ctaLabel, ctaUrl, nome, unsubscribeUrl } = args

  let body = ''

  if (templateKey === 'anuncio') {
    body = [
      heroImage(content.imagem_url),
      title(content.titulo, nome),
      paragraphs(content.texto, nome),
      ctaButton(ctaLabel, ctaUrl),
    ].join('')
  } else if (templateKey === 'simples') {
    body = [title(content.titulo, nome), paragraphs(content.texto, nome), ctaButton(ctaLabel, ctaUrl)].join('')
  } else {
    const meta =
      content.data || content.local
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">${metaRow('Quando', content.data)}${metaRow('Onde', content.local)}</table>`
        : ''
    body = [
      heroImage(content.imagem_url),
      title(content.titulo, nome),
      meta,
      paragraphs(content.texto, nome),
      ctaButton(ctaLabel, ctaUrl),
    ].join('')
  }

  return document(preheaderBlock(preheader) + body + footer(unsubscribeUrl), subject)
}
