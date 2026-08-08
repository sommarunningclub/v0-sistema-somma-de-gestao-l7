import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeEmail } from '@/lib/email/normalize'
import { addSuppression } from '@/lib/email/suppression'
import { verifySvixSignature } from '@/lib/email/svix'
import type { RecipientStatus } from '@/lib/email/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

/** Impede regressão: um 'delivered' atrasado não sobrescreve um 'clicado'. */
const STATUS_RANK: Record<string, number> = {
  enviado: 1,
  entregue: 2,
  aberto: 3,
  clicado: 4,
}

const EVENT_TO_STATUS: Record<string, RecipientStatus> = {
  sent: 'enviado',
  delivered: 'entregue',
  opened: 'aberto',
  clicked: 'clicado',
  bounced: 'bounce',
  complained: 'spam',
  failed: 'falha',
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  const valid = verifySvixSignature({
    secret: process.env.RESEND_WEBHOOK_SECRET,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    body,
  })

  if (!valid) {
    console.error('[email-campaigns/webhook] assinatura inválida')
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  try {
    const payload = JSON.parse(body) as {
      type?: string
      data?: { email_id?: string; to?: string[]; click?: { link?: string } }
    }

    const type = (payload.type ?? '').replace('email.', '')
    const emailId = payload.data?.email_id
    const link = payload.data?.click?.link ?? null

    if (!type || !emailId) return NextResponse.json({ ok: true })

    const supabase = getSupabase()

    // Só nos interessam envios feitos por este módulo. O 1-ano-SommaDay
    // compartilha o banco e tem o próprio webhook.
    const { data: recipient } = await supabase
      .from('email_campaign_recipients')
      .select('id,campaign_id,email,status')
      .eq('resend_email_id', emailId)
      .maybeSingle()

    if (!recipient) return NextResponse.json({ ok: true })

    await supabase.from('email_campaign_events').insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      email: recipient.email,
      resend_email_id: emailId,
      type,
      link,
    })

    const nextStatus = EVENT_TO_STATUS[type]
    if (nextStatus) {
      const currentRank = STATUS_RANK[recipient.status] ?? 0
      const nextRank = STATUS_RANK[nextStatus] ?? 0
      // bounce/spam/falha não estão no ranking e sempre vencem.
      if (nextRank === 0 || nextRank > currentRank) {
        await supabase
          .from('email_campaign_recipients')
          .update({ status: nextStatus })
          .eq('id', recipient.id)
      }
    }

    if (type === 'bounced' || type === 'complained') {
      const email = normalizeEmail(recipient.email)
      if (email) {
        await addSuppression(email, type === 'bounced' ? 'bounce' : 'complaint', recipient.campaign_id)
      }
    }
  } catch (e) {
    console.error('[email-campaigns/webhook] exception:', e)
  }

  // Sempre 200 depois de autenticado, para a Resend não reenviar em loop.
  return NextResponse.json({ ok: true })
}
