export function normalizeSearchQuery(query: string): string {
  return query.toLowerCase().trim()
}

export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Escapa caracteres especiais do operador ilike do Postgres/Supabase */
export function escapeIlike(term: string): string {
  return term.replace(/[%_\\]/g, '\\$&')
}

export function matchesTextSearch(
  query: string,
  fields: (string | null | undefined)[]
): boolean {
  if (!query.trim()) return true
  const q = normalizeSearchQuery(query)
  const qDigits = stripNonDigits(query)

  return fields.some((field) => {
    if (!field) return false
    const lower = field.toLowerCase()
    if (lower.includes(q)) return true
    if (qDigits.length > 0 && stripNonDigits(field).includes(qDigits)) return true
    return false
  })
}
