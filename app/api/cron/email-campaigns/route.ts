import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchSlice, prepareCampaign } from '@/lib/email/dispatch'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

// Fail-closed, igual a app/api/cron/eventos/route.ts.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = getSupabase()
  const now = new Date().toISOString()
  const processed: Array<{ id: string; sent: number; remaining: number }> = []

  try {
    // 1) Promove as agendadas que já venceram.
    const { data: due } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'agendada')
      .lte('scheduled_at', now)

    for (const campaign of due ?? []) {
      const prepared = await prepareCampaign(campaign.id)
      await supabase
        .from('email_campaigns')
        .update(
          prepared && prepared.total > 0
            ? { status: 'enviando', started_at: now }
            : { status: 'erro', error: 'Audiência vazia', finished_at: now },
        )
        .eq('id', campaign.id)
    }

    // 2) Processa uma fatia de cada campanha em andamento.
    const { data: running } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'enviando')

    for (const campaign of running ?? []) {
      const result = await dispatchSlice(campaign.id)
      processed.push({ id: campaign.id, sent: result.sent, remaining: result.remaining })

      if (result.remaining === 0) {
        await supabase
          .from('email_campaigns')
          .update({ status: 'enviada', finished_at: new Date().toISOString() })
          .eq('id', campaign.id)
      }
    }
  } catch (err) {
    console.error('[email-campaigns/cron] exception:', err)
    return NextResponse.json({ error: 'Erro no agendador' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, processed })
}
