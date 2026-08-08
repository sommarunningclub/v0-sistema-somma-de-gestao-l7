export const COLORS = {
  black: '#0a0a0a',
  white: '#ffffff',
  orange: '#f97316',
  gray: '#737373',
  border: '#e5e5e5',
} as const

export function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Substitui {{nome}} e escapa tudo. Sem nome, o placeholder vira string vazia. */
export function interpolate(text: string, nome: string | null): string {
  const safeNome = nome ? escapeHtml(nome) : ''
  return escapeHtml(text).replace(/\{\{\s*nome\s*\}\}/g, safeNome)
}

/** Quebra o texto em parágrafos por linha em branco. */
export function paragraphs(text: string, nome: string | null): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLORS.black};">${interpolate(
          block,
          nome,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('')
}

export function ctaButton(label: string | null | undefined, url: string | null | undefined): string {
  if (!label || !url) return ''
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-radius:6px;background-color:${COLORS.orange};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:700;color:${COLORS.white};text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>`
}

export function heroImage(url: string | null | undefined): string {
  if (!url) return ''
  return `<img src="${escapeHtml(url)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;margin:0 0 24px;" />`
}

export function preheaderBlock(preheader: string | null | undefined): string {
  if (!preheader) return ''
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>`
}

export function footer(unsubscribeUrl: string): string {
  return `
    <hr style="border:0;border-top:1px solid ${COLORS.border};margin:32px 0 16px;" />
    <p style="margin:0;font-size:12px;line-height:1.5;color:${COLORS.gray};">
      Você recebeu este e-mail porque faz parte da base do Somma Running Club.<br />
      <a href="${escapeHtml(unsubscribeUrl)}" style="color:${COLORS.gray};text-decoration:underline;">Não quero mais receber estes e-mails</a>
    </p>`
}

export function document(inner: string, subject: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:${COLORS.white};border-radius:8px;padding:32px;font-family:Helvetica,Arial,sans-serif;">
<tr><td>${inner}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}
