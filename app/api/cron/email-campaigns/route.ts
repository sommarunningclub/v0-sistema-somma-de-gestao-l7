import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { dispatchSlice, finalizeSlice, prepareCampaign } from '@/lib/email/dispatch'

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
  const processed: Array<{
    id: string
    ok: boolean
    sent: number
    remaining: number
    error: string | null
  }> = []
  // Campanhas cuja audiência não pôde ser lida nesta execução (erro
  // transiente) — distinto de `processed`, que é sobre fatias de disparo.
  // Ficam 'agendada' e o próximo tick tenta de novo; ver o `continue` abaixo.
  const postponed: string[] = []

  try {
    // 1) Promove as agendadas que já venceram.
    const { data: due } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'agendada')
      .lte('scheduled_at', now)

    for (const campaign of due ?? []) {
      const prepared = await prepareCampaign(campaign.id)

      // `null` = não foi possível ler a audiência (erro transiente do
      // Supabase ao paginar, ou falha ao carregar a supressão — já logado
      // dentro de `prepareCampaign`). Isso é diferente de `{ total: 0 }`
      // (leu tudo e a audiência é genuinamente vazia). Não mude o status:
      // deixar 'agendada' faz o próximo tick do cron (5 min depois) tentar de
      // novo. Sem isso a campanha era marcada 'erro' com o diagnóstico falso
      // "Audiência vazia" e nunca mais era retomada, já que o cron só
      // seleciona campanhas 'agendada'/'enviando'.
      if (prepared === null) {
        console.error(
          '[email-campaigns/cron] audiência indisponível — campanha adiada para o próximo tick:',
          campaign.id,
        )
        postponed.push(campaign.id)
        continue
      }

      await supabase
        .from('email_campaigns')
        .update(
          prepared.total > 0
            ? { status: 'enviando', started_at: now }
            : { status: 'erro', error: 'Audiência vazia', finished_at: now },
        )
        .eq('id', campaign.id)
        // `prepareCampaign` de uma base grande demora, e o operador pode
        // cancelar nesse meio-tempo. Sem esta guarda a promoção sobrescreveria
        // o cancelamento e a campanha sairia assim mesmo.
        .eq('status', 'agendada')
    }

    // 2) Processa uma fatia de cada campanha em andamento.
    const { data: running } = await supabase
      .from('email_campaigns')
      .select('id')
      .eq('status', 'enviando')

    for (const campaign of running ?? []) {
      const result = await dispatchSlice(campaign.id)
      // A transição de estado da campanha vive em `finalizeSlice`, que só
      // encerra quando a fatia realmente terminou (`ok`) e só escreve sobre
      // uma campanha ainda 'enviando' — um cancelamento durante a fatia não é
      // sobrescrito. `remaining === 0` sozinho não significa "acabou": também
      // é o que uma falha precoce devolve.
      await finalizeSlice(campaign.id, result)
      processed.push({
        id: campaign.id,
        ok: result.ok,
        sent: result.sent,
        remaining: result.remaining,
        error: result.error,
      })
    }
  } catch (err) {
    console.error('[email-campaigns/cron] exception:', err)
    return NextResponse.json({ error: 'Erro no agendador' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, processed, postponed })
}
