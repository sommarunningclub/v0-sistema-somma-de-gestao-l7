/**
 * O client manda a URL pública devolvida pelo Supabase Storage depois de
 * subir o arquivo. Como é o browser quem monta essa string, ela precisa ser
 * validada antes de virar link clicável no painel: sem isso dava para gravar
 * `javascript:` ou apontar o anexo para um host externo qualquer.
 *
 * Regra: https, host do próprio projeto Supabase (quando NEXT_PUBLIC_SUPABASE_URL
 * está configurada) e tamanho limitado.
 */
const MAX_URL_LEN = 2048

export function isValidAttachmentUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LEN) return false

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }

  if (url.protocol !== 'https:') return false

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (base) {
    try {
      if (url.host !== new URL(base).host) return false
    } catch {
      return false
    }
  }

  return true
}
