export interface Recipient {
  email: string
  nome: string | null
  sourceBase: string
}

/** Aceita apenas endereços plausíveis: algo@algo.tld, sem espaços. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return null
  return normalized
}

/**
 * Une várias listas de destinatários preservando a PRIMEIRA ocorrência de cada
 * e-mail. A ordem das listas define a prioridade de `sourceBase`.
 */
export function dedupeRecipients(lists: Recipient[][]): Recipient[] {
  const seen = new Set<string>()
  const out: Recipient[] = []

  for (const list of lists) {
    for (const item of list) {
      const email = normalizeEmail(item.email)
      if (!email || seen.has(email)) continue
      seen.add(email)
      out.push({ email, nome: item.nome, sourceBase: item.sourceBase })
    }
  }

  return out
}
