import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveAudience } from './audiences'
import { normalizeEmail } from './normalize'
import { isSuppressed } from './suppression'
import { renderTemplate } from './templates'
import { signUnsubscribeToken } from './unsubscribe-token'
import type { EmailCampaign } from './types'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Limite de destinatários por chamada do lote da Resend. */
const BATCH_SIZE = 100
/** Pausa entre lotes, para ficar abaixo do rate limit de 2 req/s da Resend. */
const THROTTLE_MS = 600
/** Teto de destinatários por execução, para caber no maxDuration da rota. */
const DEFAULT_SLICE = 2000
const MAX_RETRIES = 3

export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) throw new Error(`Tamanho de lote inválido: ${size}`)
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function unsubscribeUrl(email: string, campaignId: string | null): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://admin.sommaclub.com.br'
  const token = signUnsubscribeToken(email, campaignId, getSecret())
  return `${base}/api/unsubscribe?t=${encodeURIComponent(token)}`
}

async function getCampaign(campaignId: string): Promise<EmailCampaign | null> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) {
    console.error('[email] getCampaign error:', error)
    return null
  }
  return data as EmailCampaign
}

/**
 * Congela a audiência da campanha: uma linha `pendente` por destinatário.
 * Idempotente — a constraint UNIQUE (campaign_id, email) absorve repetições,
 * então chamar duas vezes não duplica nem reenvia.
 */
export async function prepareCampaign(campaignId: string): Promise<{ total: number } | null> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) return null

  const recipients = await resolveAudience(campaign.audience)
  const supabase = getSupabase()

  for (const group of chunk(recipients, 500)) {
    const { error } = await supabase.from('email_campaign_recipients').upsert(
      group.map((r) => ({
        campaign_id: campaignId,
        email: r.email,
        nome: r.nome,
        source_base: r.sourceBase,
        status: 'pendente' as const,
      })),
      { onConflict: 'campaign_id,email', ignoreDuplicates: true },
    )

    if (error) {
      console.error('[email] prepareCampaign upsert error:', error)
      return null
    }
  }

  const { count } = await supabase
    .from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)

  const total = count ?? recipients.length
  await supabase
    .from('email_campaigns')
    .update({ total_recipients: total, updated_at: new Date().toISOString() })
    .eq('id', campaignId)

  return { total }
}

function buildPayload(
  campaign: EmailCampaign,
  recipient: { email: string; nome: string | null },
  from: string,
) {
  const url = unsubscribeUrl(recipient.email, campaign.id)
  return {
    from,
    to: [recipient.email],
    subject: campaign.subject,
    html: renderTemplate({
      templateKey: campaign.template_key,
      subject: campaign.subject,
      preheader: campaign.preheader,
      content: campaign.content,
      ctaLabel: campaign.cta_label,
      ctaUrl: campaign.cta_url,
      nome: recipient.nome,
      unsubscribeUrl: url,
    }),
    headers: {
      'List-Unsubscribe': `<${url}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}

/**
 * Envia uma fatia dos pendentes. Devolve o controle para o chamador com o
 * número de restantes, para que o cron retome na execução seguinte.
 */
export async function dispatchSlice(
  campaignId: string,
  maxRecipients: number = DEFAULT_SLICE,
): Promise<{ sent: number; failed: number; remaining: number }> {
  const campaign = await getCampaign(campaignId)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!campaign || !apiKey || !from) {
    console.error('[email] dispatchSlice: campanha, RESEND_API_KEY ou EMAIL_FROM ausente')
    return { sent: 0, failed: 0, remaining: 0 }
  }

  const supabase = getSupabase()
  const resend = new Resend(apiKey)

  const { data: pending, error } = await supabase
    .from('email_campaign_recipients')
    .select('id,email,nome')
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')
    .limit(maxRecipients)

  if (error) {
    console.error('[email] dispatchSlice select error:', error)
    return { sent: 0, failed: 0, remaining: 0 }
  }

  let sent = 0
  let failed = 0
  const groups = chunk(pending ?? [], BATCH_SIZE)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    const payload = group.map((r) => buildPayload(campaign, r, from))

    let ids: Array<{ id: string }> = []
    let lastError: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error: sendError } = await resend.batch.send(payload)
        if (sendError) {
          lastError = sendError.message
          await sleep(THROTTLE_MS * attempt * 2)
          continue
        }
        // O formato do retorno mudou entre versões do SDK.
        const raw = (data as unknown as { data?: Array<{ id: string }> })?.data
        ids = Array.isArray(raw) ? raw : Array.isArray(data) ? (data as Array<{ id: string }>) : []
        lastError = null
        break
      } catch (e) {
        lastError = String(e)
        await sleep(THROTTLE_MS * attempt * 2)
      }
    }

    const now = new Date().toISOString()

    if (lastError) {
      // Falha após as tentativas: marca o lote e segue. Volta a ser tentado
      // num disparo futuro só se for reposto para 'pendente' manualmente.
      failed += group.length
      for (const r of group) {
        await supabase
          .from('email_campaign_recipients')
          .update({ status: 'falha', error: lastError.slice(0, 500) })
          .eq('id', r.id)
      }
    } else {
      sent += group.length
      for (let idx = 0; idx < group.length; idx++) {
        await supabase
          .from('email_campaign_recipients')
          .update({
            status: 'enviado',
            resend_email_id: ids[idx]?.id ?? null,
            sent_at: now,
            error: null,
          })
          .eq('id', group[idx].id)
      }
    }

    if (i < groups.length - 1) await sleep(THROTTLE_MS)
  }

  const { count } = await supabase
    .from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')

  return { sent, failed, remaining: count ?? 0 }
}

/** Envio de teste. Respeita a supressão, como todo o resto. */
export async function sendTestEmail(
  campaignId: string,
  to: string,
): Promise<{ ok: boolean; error?: string }> {
  const email = normalizeEmail(to)
  if (!email) return { ok: false, error: 'E-mail de teste inválido' }

  if (await isSuppressed(email)) {
    return { ok: false, error: 'Este e-mail está na lista de descadastro' }
  }

  const campaign = await getCampaign(campaignId)
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!campaign) return { ok: false, error: 'Campanha não encontrada' }
  if (!apiKey || !from) return { ok: false, error: 'RESEND_API_KEY ou EMAIL_FROM não configurado' }

  const resend = new Resend(apiKey)
  const payload = buildPayload(campaign, { email, nome: 'Teste' }, from)

  const { error } = await resend.emails.send({
    ...payload,
    subject: `[TESTE] ${campaign.subject}`,
  })

  if (error) {
    console.error('[email] sendTestEmail error:', error)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}
