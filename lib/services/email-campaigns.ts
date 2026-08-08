// lib/services/email-campaigns.ts
import { createClient } from '@supabase/supabase-js'
import type {
  AudienceSelection,
  CampaignStats,
  CampaignStatus,
  EmailCampaign,
  RecipientStatus,
} from '@/lib/email/types'
import type { TemplateFields, TemplateKey } from '@/lib/email/templates'

// Service role — NÃO importar de lib/supabase-client.ts (chave anon).
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  nome: string
  template_key: TemplateKey
  subject: string
  preheader?: string | null
  content: TemplateFields
  cta_label?: string | null
  cta_url?: string | null
  audience: AudienceSelection
  scheduled_at?: string | null
  created_by?: string | null
}

export interface UpdateCampaignPatch extends Partial<CreateCampaignInput> {
  status?: CampaignStatus
  scheduled_at?: string | null
  started_at?: string | null
  finished_at?: string | null
  total_recipients?: number
  error?: string | null
}

export interface RecipientRow {
  id: string
  email: string
  nome: string | null
  source_base: string | null
  status: RecipientStatus
  error: string | null
  sent_at: string | null
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<EmailCampaign[]> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[email-campaigns] getCampaigns error:', error)
      return []
    }
    return (data ?? []) as EmailCampaign[]
  } catch (e) {
    console.error('[email-campaigns] getCampaigns exception:', e)
    return []
  }
}

export async function getCampaignById(id: string): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from('email_campaigns').select('*').eq('id', id).single()

    if (error) {
      console.error('[email-campaigns] getCampaignById error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] getCampaignById exception:', e)
    return null
  }
}

export async function createCampaign(input: CreateCampaignInput): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .insert({ ...input, status: input.scheduled_at ? 'agendada' : 'rascunho' })
      .select()
      .single()

    if (error) {
      console.error('[email-campaigns] createCampaign error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] createCampaign exception:', e)
    return null
  }
}

export async function updateCampaign(
  id: string,
  patch: UpdateCampaignPatch,
): Promise<EmailCampaign | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaigns')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[email-campaigns] updateCampaign error:', error)
      return null
    }
    return data as EmailCampaign
  } catch (e) {
    console.error('[email-campaigns] updateCampaign exception:', e)
    return null
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    const supabase = getSupabase()
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id)

    if (error) {
      console.error('[email-campaigns] deleteCampaign error:', error)
      return false
    }
    return true
  } catch (e) {
    console.error('[email-campaigns] deleteCampaign exception:', e)
    return false
  }
}

export async function getCampaignStats(id: string): Promise<CampaignStats | null> {
  try {
    const supabase = getSupabase()

    const [recipientsRes, unsubRes] = await Promise.all([
      supabase.from('email_campaign_recipients').select('status').eq('campaign_id', id),
      supabase
        .from('email_suppressions')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
        .eq('reason', 'unsubscribe'),
    ])

    if (recipientsRes.error) {
      console.error('[email-campaigns] getCampaignStats error:', recipientsRes.error)
      return null
    }

    const stats: CampaignStats = {
      total: 0,
      pendente: 0,
      enviado: 0,
      entregue: 0,
      aberto: 0,
      clicado: 0,
      bounce: 0,
      spam: 0,
      falha: 0,
      descadastros: unsubRes.count ?? 0,
    }

    for (const row of recipientsRes.data ?? []) {
      stats.total++
      const key = row.status as RecipientStatus
      if (key in stats) stats[key]++
    }

    return stats
  } catch (e) {
    console.error('[email-campaigns] getCampaignStats exception:', e)
    return null
  }
}

export async function getCampaignRecipients(
  id: string,
  status?: RecipientStatus,
): Promise<RecipientRow[]> {
  try {
    const supabase = getSupabase()
    let query = supabase
      .from('email_campaign_recipients')
      .select('id,email,nome,source_base,status,error,sent_at')
      .eq('campaign_id', id)
      .order('sent_at', { ascending: false, nullsFirst: false })
      .limit(1000)

    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) {
      console.error('[email-campaigns] getCampaignRecipients error:', error)
      return []
    }
    return (data ?? []) as RecipientRow[]
  } catch (e) {
    console.error('[email-campaigns] getCampaignRecipients exception:', e)
    return []
  }
}

export interface DailyEventPoint {
  date: string
  abertos: number
  clicados: number
}

// Agrupa por dia de calendário em America/Sao_Paulo, não UTC — um evento às
// 21h-23h59 no horário de Brasília cairia no dia seguinte se fatiássemos a
// string ISO (que vem em UTC) direto. Locale 'en-CA' formata como YYYY-MM-DD,
// igual ao que `page.tsx` espera para parsear a data de volta como local.
const SAO_PAULO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Série diária de aberturas/cliques para o gráfico da Task 13. `email_campaign_events`
 * guarda um evento por ocorrência (created_at real), diferente de
 * `email_campaign_recipients.status`, que é um snapshot (um clique sobrescreve o
 * status 'aberto' do destinatário — ver STATUS_RANK no webhook). Por isso a série
 * vem daqui, não de getCampaignStats.
 */
export async function getCampaignEventSeries(id: string): Promise<DailyEventPoint[]> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaign_events')
      .select('type,created_at')
      .eq('campaign_id', id)
      .in('type', ['opened', 'clicked'])
      // Sem order(), o Postgres/PostgREST não garante quais linhas sobrevivem
      // ao limit — e clientes de e-mail com pré-carregamento de imagem (ex.:
      // Apple Mail Privacy Protection) podem gerar vários 'opened' por
      // destinatário, então uma campanha modesta pode passar de 10 mil
      // eventos. Ordenar por created_at faz o corte ser previsível (descarta
      // os eventos mais recentes, não um subconjunto arbitrário).
      .order('created_at', { ascending: true })
      .limit(10000)

    if (error) {
      console.error('[email-campaigns] getCampaignEventSeries error:', error)
      return []
    }

    const byDate = new Map<string, DailyEventPoint>()
    for (const row of data ?? []) {
      const date = SAO_PAULO_DATE_FORMATTER.format(new Date(row.created_at))
      const point = byDate.get(date) ?? { date, abertos: 0, clicados: 0 }
      if (row.type === 'opened') point.abertos++
      else if (row.type === 'clicked') point.clicados++
      byDate.set(date, point)
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  } catch (e) {
    console.error('[email-campaigns] getCampaignEventSeries exception:', e)
    return []
  }
}

export async function getCampaignClickedLinks(
  id: string,
): Promise<Array<{ link: string; count: number }>> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('email_campaign_events')
      .select('link')
      .eq('campaign_id', id)
      .eq('type', 'clicked')
      .limit(5000)

    if (error) {
      console.error('[email-campaigns] getCampaignClickedLinks error:', error)
      return []
    }

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      if (!row.link) continue
      counts.set(row.link, (counts.get(row.link) ?? 0) + 1)
    }

    return [...counts.entries()]
      .map(([link, count]) => ({ link, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  } catch (e) {
    console.error('[email-campaigns] getCampaignClickedLinks exception:', e)
    return []
  }
}
