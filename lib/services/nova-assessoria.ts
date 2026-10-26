// lib/services/nova-assessoria.ts

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { inicioDoPeriodo, type EventoBora, type Periodo, type Rodizio } from '@/lib/nova-assessoria/resumo'

/**
 * Leitura do módulo Nova Assessoria. As tabelas (`nova_assessoria_*`) são do
 * site e não têm policy nenhuma: só a service role lê, e só aqui, server-side.
 */

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) throw new Error('Banco não configurado neste ambiente.')
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } })
}

// O PostgREST devolve no máximo 1000 linhas por pedido; o painel pagina até
// este teto e avisa quando passa dele.
const POR_PAGINA = 1000
const TETO = 20000

export async function carregarRodizio(): Promise<Rodizio | null> {
  const { data, error } = await db().from('nova_assessoria_rodizio').select('ordem, posicao').eq('id', 1).maybeSingle()
  if (error) throw error
  if (!data) return null
  const ordem: string[] = data.ordem ?? []
  const posicao = Number(data.posicao ?? 0)
  return { ordem, posicao, proximo: ordem.length ? ordem[posicao % ordem.length] : null }
}

export async function carregarEventos(periodo: Periodo): Promise<{ eventos: EventoBora[]; truncado: boolean }> {
  const supabase = db()
  const desde = inicioDoPeriodo(periodo)
  const eventos: EventoBora[] = []

  for (let de = 0; de < TETO; de += POR_PAGINA) {
    let consulta = supabase
      .from('nova_assessoria_eventos')
      .select('*')
      .order('criado_em', { ascending: false })
      .order('id', { ascending: false })
      .range(de, de + POR_PAGINA - 1)
    if (desde) consulta = consulta.gte('criado_em', desde)
    const { data, error } = await consulta
    if (error) throw error
    eventos.push(...((data ?? []) as EventoBora[]))
    if (!data || data.length < POR_PAGINA) return { eventos, truncado: false }
  }
  return { eventos, truncado: true }
}
