import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { resolveAudience } from './audiences'
import { normalizeEmail, type Recipient } from './normalize'
import { filterSuppressed, isSuppressed } from './suppression'
import { renderTemplate } from './templates'
import { signUnsubscribeToken } from './unsubscribe-token'
import type { CampaignStatus, EmailCampaign } from './types'

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
/**
 * Tempo após o qual uma reserva é considerada órfã e volta para a fila.
 *
 * A reserva é feita gravando `sent_at` na linha ainda `pendente` (ver
 * `claimGroup`). Se a execução morrer no meio (timeout da Vercel, deploy,
 * crash), essas linhas ficariam reservadas para sempre e a campanha nunca
 * terminaria. Precisa ser confortavelmente maior que o `maxDuration` das rotas
 * (300s), senão uma reserva viva seria roubada por outra execução — que é
 * exatamente o envio duplicado que a reserva existe para impedir.
 */
const CLAIM_TTL_MS = 15 * 60 * 1000

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
  const base = process.env.NEXT_PUBLIC_APP_URL
  // Sem fallback: um domínio chutado aqui viaja dentro de cada e-mail enviado
  // e não tem como ser corrigido depois — o link de descadastro simplesmente
  // não resolveria, para sempre, em caixas de entrada que não alcançamos mais.
  // Falhar alto é a única saída segura (LGPD + reputação do domínio, que é
  // compartilhado com o outro sistema).
  if (!base) {
    throw new Error('NEXT_PUBLIC_APP_URL não configurada — link de descadastro inválido')
  }
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
 * Lê só o status atual da campanha. Usado entre os lotes para respeitar o
 * cancelamento — `undefined` significa "não consegui ler", e o chamador
 * trata isso como motivo para parar (não como "siga em frente").
 */
async function readCampaignStatus(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignStatus | undefined> {
  const { data, error } = await supabase
    .from('email_campaigns')
    .select('status')
    .eq('id', campaignId)
    .single()

  if (error || !data) {
    console.error('[email] readCampaignStatus error:', error)
    return undefined
  }
  return (data as { status: CampaignStatus }).status
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
  // `null` = alguma base ou a lista de supressão não pôde ser lida. Congelar
  // uma audiência parcial mandaria a campanha para menos gente do que a tela
  // de revisão prometeu, sem nenhum sinal.
  if (recipients === null) {
    console.error('[email] prepareCampaign: audiência indisponível (erro de leitura)')
    return null
  }

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

interface PendingRow {
  id: string
  email: string
  nome: string | null
}

export interface DispatchSliceResult {
  /**
   * `true` só quando a fatia percorreu tudo o que se propôs a percorrer.
   * Qualquer aborto (erro de infraestrutura, cancelamento, configuração
   * ausente) devolve `false` — e `remaining === 0` só pode ser lido como
   * "campanha concluída" junto com `ok === true`.
   */
  ok: boolean
  /** Enviados nesta fatia. */
  sent: number
  /** Falhas nesta fatia. */
  failed: number
  /** Pendentes na campanha inteira depois desta fatia. */
  remaining: number
  /** Problema de configuração: repetir não resolve, a campanha precisa parar. */
  fatal: boolean
  /** A campanha deixou de estar 'enviando' (cancelada) — parada deliberada. */
  canceled: boolean
  error: string | null
}

function makeResult(over: Partial<DispatchSliceResult> = {}): DispatchSliceResult {
  return {
    ok: false,
    sent: 0,
    failed: 0,
    remaining: 0,
    fatal: false,
    canceled: false,
    error: null,
    ...over,
  }
}

/**
 * Reserva atômica de um lote.
 *
 * `UPDATE ... WHERE id IN (...) AND status='pendente' AND sent_at IS NULL
 * RETURNING id` — no READ COMMITTED do Postgres, duas execuções concorrentes
 * serializam no lock da linha e a segunda reavalia o WHERE depois do commit da
 * primeira, então cada linha só é devolvida para UMA delas. As linhas
 * devolvidas são as que esta execução pode enviar; as demais são de outra.
 *
 * A marca de reserva é o próprio `sent_at` (uma coluna que já existe) em vez de
 * um status novo — assim não é preciso alterar o CHECK constraint de
 * `email_campaign_recipients.status` num banco de produção compartilhado.
 * Toda saída terminal desta função repõe `sent_at` (hora real do envio, ou
 * `null` em falha/liberação), então a coluna nunca fica mentindo numa linha
 * que já parou de ser processada.
 */
async function claimGroup(
  supabase: SupabaseClient,
  group: PendingRow[],
): Promise<PendingRow[] | null> {
  const { data, error } = await supabase
    .from('email_campaign_recipients')
    .update({ sent_at: new Date().toISOString() })
    .in(
      'id',
      group.map((r) => r.id),
    )
    .eq('status', 'pendente')
    .is('sent_at', null)
    .select('id')

  if (error) {
    console.error('[email] claimGroup error:', error)
    return null
  }

  const claimed = new Set((data ?? []).map((r) => (r as { id: string }).id))
  return group.filter((r) => claimed.has(r.id))
}

/** Devolve as linhas reservadas para a fila, intactas. */
async function releaseClaim(supabase: SupabaseClient, rows: PendingRow[]): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('email_campaign_recipients')
    .update({ sent_at: null })
    .in(
      'id',
      rows.map((r) => r.id),
    )
    .eq('status', 'pendente')

  if (error) console.error('[email] releaseClaim error:', error)
}

/**
 * Envia uma fatia dos pendentes. Devolve o controle para o chamador com o
 * número de restantes, para que o cron retome na execução seguinte.
 */
export async function dispatchSlice(
  campaignId: string,
  maxRecipients: number = DEFAULT_SLICE,
): Promise<DispatchSliceResult> {
  const campaign = await getCampaign(campaignId)
  if (!campaign) {
    console.error('[email] dispatchSlice: campanha não encontrada:', campaignId)
    return makeResult({ error: 'Campanha não encontrada' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!apiKey || !from || !appUrl) {
    const missing = [
      !apiKey && 'RESEND_API_KEY',
      !from && 'EMAIL_FROM',
      !appUrl && 'NEXT_PUBLIC_APP_URL',
    ].filter(Boolean)
    const error = `Configuração ausente: ${missing.join(', ')}`
    console.error(`[email] dispatchSlice: ${error}`)
    // fatal: repetir a cada 5 min não resolve — a campanha precisa ir para
    // 'erro' com o motivo visível, em vez de virar 'enviada' sem ter enviado.
    return makeResult({ fatal: true, error })
  }

  // Só campanhas em disparo. Um cancelamento entre a seleção do cron e este
  // ponto para o envio aqui.
  if (campaign.status !== 'enviando') {
    return makeResult({
      canceled: true,
      error: `Campanha não está mais em disparo (status: ${campaign.status})`,
    })
  }

  const supabase = getSupabase()
  const resend = new Resend(apiKey)

  // Reservas órfãs de execuções que morreram no meio voltam para a fila.
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString()
  const { error: staleError } = await supabase
    .from('email_campaign_recipients')
    .update({ sent_at: null })
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')
    .lt('sent_at', staleBefore)
  if (staleError) console.error('[email] dispatchSlice release stale error:', staleError)

  const { data: pending, error } = await supabase
    .from('email_campaign_recipients')
    .select('id,email,nome')
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')
    // Ignora o que outra execução já reservou — a fatia rende trabalho útil
    // em vez de brigar pelas mesmas linhas.
    .is('sent_at', null)
    // Sem ordem explícita o Postgres não garante o mesmo recorte entre duas
    // consultas com LIMIT; as fatias precisam ser determinísticas.
    .order('id')
    .limit(maxRecipients)

  if (error) {
    console.error('[email] dispatchSlice select error:', error)
    return makeResult({ error: 'Falha ao carregar os destinatários pendentes' })
  }

  let sent = 0
  let failed = 0
  let aborted: DispatchSliceResult | null = null
  const groups = chunk((pending ?? []) as PendingRow[], BATCH_SIZE)

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]

    // Cancelamento é freio de emergência: relê o status a cada lote para não
    // continuar mandando e-mail depois que o operador apertou o botão. Uma
    // consulta por lote, ao lado das ~100 updates que este mesmo lote já faz.
    if (i > 0) {
      const status = await readCampaignStatus(supabase, campaignId)
      if (status !== 'enviando') {
        aborted = makeResult({
          canceled: status !== undefined,
          error:
            status === undefined
              ? 'Falha ao reler o status da campanha'
              : `Disparo interrompido (status: ${status})`,
        })
        break
      }
    }

    // Reserva antes de enviar. O que não for reservado aqui é de outra
    // execução — que já vai enviar para essas pessoas.
    const claimed = await claimGroup(supabase, group)
    if (claimed === null) {
      aborted = makeResult({ error: 'Falha ao reservar o lote' })
      break
    }
    if (claimed.length === 0) continue

    // Reconfere a supressão pouco antes de enviar. `prepareCampaign` já
    // filtrou a audiência ao congelá-la, mas um destinatário pode se
    // descadastrar, dar bounce ou reclamar entre aquele momento e este —
    // sobretudo em campanhas grandes, retomadas ao longo de várias execuções
    // do cron. Nenhum caminho de código pode enviar para quem está em
    // `email_suppressions`.
    const asRecipients: Recipient[] = claimed.map((r) => ({
      email: r.email,
      nome: r.nome,
      sourceBase: '',
    }))
    const allowed = await filterSuppressed(asRecipients)

    // `null` = a lista de supressão não pôde ser lida. Não dá para distinguir
    // "todos suprimidos" de "não sei" olhando só o tamanho da lista, e queimar
    // o lote com 'suprimido antes do envio' seria destruir até 100 linhas por
    // erro de infraestrutura, com uma justificativa falsa e sem caminho de
    // retry. Devolve tudo para a fila e aborta a fatia.
    if (allowed === null) {
      await releaseClaim(supabase, claimed)
      aborted = makeResult({ error: 'Lista de supressão indisponível — fatia interrompida' })
      break
    }

    const allowedEmails = new Set(allowed.map((r) => r.email))
    const sendable = claimed.filter((r) => allowedEmails.has(r.email))
    const suppressedNow = claimed.filter((r) => !allowedEmails.has(r.email))

    if (suppressedNow.length > 0) {
      failed += suppressedNow.length
      for (const r of suppressedNow) {
        await supabase
          .from('email_campaign_recipients')
          // sent_at volta a null: a linha parou aqui, não foi enviada.
          .update({ status: 'falha', error: 'suprimido antes do envio', sent_at: null })
          .eq('id', r.id)
      }
    }

    if (sendable.length > 0) {
      const payload = sendable.map((r) => buildPayload(campaign, r, from))
      // Chave estável por lote (não muda entre as tentativas de retry
      // abaixo): se uma exceção de rede deixar ambíguo se a Resend já
      // processou o envio, o retry com a mesma chave não duplica o disparo.
      const idempotencyKey = `${campaignId}:slice:${i}:${sendable[0].id}`

      let ids: Array<{ id: string }> = []
      let batchErrors: Array<{ index: number; message: string }> = []
      let lastError: string | null = null

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { data, error: sendError } = await resend.batch.send(payload, {
            idempotencyKey,
            // Validação estrita derruba o lote inteiro por causa de um único
            // endereço que a Resend recusa — e `checkins`/`cadastro_site` são
            // anos de e-mail digitado à mão. No modo permissivo os válidos
            // saem e os recusados voltam em `errors[].index`.
            batchValidation: 'permissive',
          })
          if (sendError) {
            lastError = sendError.message
            await sleep(THROTTLE_MS * attempt * 2)
            continue
          }
          // O formato do retorno mudou entre versões do SDK.
          const raw = data as unknown as
            | { data?: Array<{ id: string }>; errors?: Array<{ index: number; message: string }> }
            | Array<{ id: string }>
            | null
          const rawData = Array.isArray(raw) ? raw : raw?.data
          ids = Array.isArray(rawData) ? rawData : []
          const rawErrors = Array.isArray(raw) ? undefined : raw?.errors
          batchErrors = Array.isArray(rawErrors) ? rawErrors : []
          lastError = null
          break
        } catch (e) {
          lastError = String(e)
          await sleep(THROTTLE_MS * attempt * 2)
        }
      }

      const now = new Date().toISOString()

      if (lastError) {
        // Falha após as tentativas: marca o lote e segue. Volta a ser
        // tentado num disparo futuro só se for reposto para 'pendente'
        // manualmente.
        failed += sendable.length
        for (const r of sendable) {
          await supabase
            .from('email_campaign_recipients')
            .update({ status: 'falha', error: lastError.slice(0, 500), sent_at: null })
            .eq('id', r.id)
        }
      } else {
        const rejected = new Map<number, string>()
        for (const e of batchErrors) {
          if (Number.isInteger(e?.index) && e.index >= 0 && e.index < sendable.length) {
            rejected.set(e.index, String(e.message ?? 'recusado pela Resend'))
          } else {
            console.error(
              '[email] resposta da Resend com índice de erro fora do lote:',
              JSON.stringify({ campaignId, chunk: i, index: e?.index, size: sendable.length }),
            )
          }
        }

        // No modo permissivo, `data` traz só os aceitos, na ordem do payload.
        const acceptedIdx = sendable.map((_, idx) => idx).filter((idx) => !rejected.has(idx))
        // Se o shape da resposta mudar de novo (já mudou uma vez), todo mundo
        // fica com resend_email_id null: o webhook nunca casa, nenhum
        // bounce/complaint chega ao addSuppression e a proteção de reputação
        // do domínio — que é compartilhado — some em silêncio. Barulho alto.
        const aligned = ids.length === acceptedIdx.length
        if (!aligned) {
          console.error(
            '[email] resposta da Resend com tamanho inesperado — resend_email_id ficará nulo e o webhook não vai casar:',
            JSON.stringify({
              campaignId,
              chunk: i,
              esperado: acceptedIdx.length,
              recebido: ids.length,
              rejeitados: rejected.size,
            }),
          )
        }

        for (let k = 0; k < acceptedIdx.length; k++) {
          const r = sendable[acceptedIdx[k]]
          await supabase
            .from('email_campaign_recipients')
            .update({
              status: 'enviado',
              resend_email_id: aligned ? (ids[k]?.id ?? null) : null,
              sent_at: now,
              error: null,
            })
            .eq('id', r.id)
        }
        sent += acceptedIdx.length

        for (const [idx, message] of rejected) {
          await supabase
            .from('email_campaign_recipients')
            .update({ status: 'falha', error: message.slice(0, 500), sent_at: null })
            .eq('id', sendable[idx].id)
        }
        failed += rejected.size
      }
    }

    if (i < groups.length - 1) await sleep(THROTTLE_MS)
  }

  const pendingCount = await supabase
    .from('email_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'pendente')

  if (pendingCount.error) {
    console.error('[email] dispatchSlice: falha ao contar o restante:', pendingCount.error)
    // Sem contagem confiável, `remaining` não pode virar "acabou".
    return makeResult({ sent, failed, error: 'Falha ao contar os destinatários restantes' })
  }

  const remaining = pendingCount.count ?? 0

  if (aborted) return { ...aborted, sent, failed, remaining }

  return makeResult({ ok: true, sent, failed, remaining })
}

/**
 * Aplica ao registro da campanha o que a fatia apurou. Fica aqui, e não em
 * cada rota, porque a transição para 'enviada' é a garantia mais fácil de
 * quebrar por divergência entre os dois chamadores (cron e disparo manual).
 *
 * Todas as transições são condicionadas a `status = 'enviando'`: se o operador
 * cancelou durante a fatia, o cancelamento não pode ser sobrescrito.
 */
export async function finalizeSlice(
  campaignId: string,
  result: DispatchSliceResult,
): Promise<void> {
  const supabase = getSupabase()
  const now = new Date().toISOString()

  const patch = (() => {
    if (result.fatal) {
      return {
        status: 'erro' as const,
        error: (result.error ?? 'Falha de configuração no disparo').slice(0, 500),
        finished_at: now,
      }
    }
    // Só uma fatia que realmente terminou pode encerrar a campanha.
    // (Uma campanha em que TODOS os destinatários falharam ainda termina como
    // 'enviada' — é o achado I4, deliberadamente fora do escopo desta onda.)
    if (!result.ok || result.remaining > 0) return null
    return { status: 'enviada' as const, error: null, finished_at: now }
  })()

  if (!patch) return

  const { error } = await supabase
    .from('email_campaigns')
    .update({ ...patch, updated_at: now })
    .eq('id', campaignId)
    .eq('status', 'enviando')

  if (error) console.error('[email] finalizeSlice error:', error)
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
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return { ok: false, error: 'NEXT_PUBLIC_APP_URL não configurada' }
  }

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
