import { createClient } from '@supabase/supabase-js'
import { normalizeEmail, type Recipient } from './normalize'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const PAGE_SIZE = 1000

/**
 * Carrega a lista inteira de suprimidos.
 *
 * Retorna `null` se qualquer página falhar — um `Set` parcial seria pior que
 * nenhum, porque `filterSuppressed` o trataria como "lista completa" e
 * deixaria passar suprimidos que ainda não foram lidos (fail-open silencioso).
 */
async function loadSuppressed(): Promise<Set<string> | null> {
  const supabase = getSupabase()
  const set = new Set<string>()

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('email_suppressions')
      .select('email')
      // Sem ORDER BY, duas consultas LIMIT/OFFSET não têm ordem garantida — e
      // esta tabela é escrita DURANTE o envio (o webhook grava bounce e
      // reclamação). Uma inserção concorrente pode empurrar uma linha através
      // da fronteira de página e fazer a varredura perdê-la, o que significa
      // enviar para quem se descadastrou. `email` é UNIQUE, então ordenar por
      // ele dá uma ordem total e estável.
      .order('email')
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error('[email] loadSuppressed error:', error)
      return null // fail-closed: lista incompleta não é confiável
    }
    if (!data || data.length === 0) break

    for (const row of data) {
      const email = normalizeEmail(row.email)
      if (email) set.add(email)
    }

    if (data.length < PAGE_SIZE) break
  }

  return set
}

/**
 * Remove os suprimidos da lista.
 *
 * Retorna `null` — e não uma lista vazia — quando a lista de supressão não
 * pôde ser lida. São dois fatos diferentes ("todo mundo está suprimido" e "não
 * sei quem está suprimido") e o chamador precisa distingui-los: tratar o
 * segundo como o primeiro marcaria centenas de destinatários como falha
 * permanente por causa de um erro transiente de infraestrutura, com uma razão
 * que não é verdade.
 */
export async function filterSuppressed(recipients: Recipient[]): Promise<Recipient[] | null> {
  if (recipients.length === 0) return []

  const suppressed = await loadSuppressed()
  if (suppressed === null) {
    // fail-closed: na dúvida (lista de supressão indisponível), não envia
    // para ninguém do lote em vez de arriscar mandar para um suprimido.
    console.error(
      '[email] filterSuppressed: lista de supressão indisponível — bloqueando lote inteiro (fail-closed)',
    )
    return null
  }

  return recipients.filter((r) => !suppressed.has(r.email))
}

export async function isSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return true // endereço inválido nunca deve receber

  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('email_suppressions')
    .select('id')
    .eq('email', normalized)
    .limit(1)

  if (error) {
    console.error('[email] isSuppressed error:', error)
    return true // fail-closed: na dúvida, não envia
  }

  return (data?.length ?? 0) > 0
}

export async function addSuppression(
  email: string,
  reason: 'unsubscribe' | 'bounce' | 'complaint' | 'manual',
  campaignId: string | null = null,
): Promise<boolean> {
  const normalized = normalizeEmail(email)
  if (!normalized) return false

  const supabase = getSupabase()
  const { error } = await supabase
    .from('email_suppressions')
    .upsert(
      { email: normalized, reason, campaign_id: campaignId },
      { onConflict: 'email', ignoreDuplicates: true },
    )

  if (error) {
    console.error('[email] addSuppression error:', error)
    return false
  }

  return true
}
