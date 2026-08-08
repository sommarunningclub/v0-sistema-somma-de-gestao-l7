import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, updateCampaign } from '@/lib/services/email-campaigns'
import { dispatchSlice, finalizeSlice, prepareCampaign } from '@/lib/email/dispatch'

export const maxDuration = 300

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (campaign.status === 'enviando' || campaign.status === 'enviada') {
    return NextResponse.json({ error: 'Esta campanha já foi disparada' }, { status: 409 })
  }

  try {
    const prepared = await prepareCampaign(id)
    if (!prepared) return NextResponse.json({ error: 'Erro ao montar a audiência' }, { status: 500 })
    if (prepared.total === 0) {
      return NextResponse.json({ error: 'A audiência selecionada está vazia' }, { status: 400 })
    }

    await updateCampaign(id, { status: 'enviando', started_at: new Date().toISOString() })

    const result = await dispatchSlice(id)
    // Idem cron: só `finalizeSlice` encerra a campanha, e só quando a fatia
    // completou de fato e a campanha ainda está 'enviando'.
    await finalizeSlice(id, result)

    // Configuração ausente (RESEND_API_KEY/EMAIL_FROM/NEXT_PUBLIC_APP_URL) não
    // manda nenhum e-mail e não adianta repetir. Sem um erro HTTP aqui, o
    // operador que clicou "disparar agora" veria o modal fechar em silêncio,
    // como se tivesse dado certo.
    if (result.fatal) {
      return NextResponse.json(
        { error: result.error ?? 'Falha de configuração no disparo' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ...result, total: prepared.total })
  } catch (err) {
    console.error('[email-campaigns/dispatch] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao disparar campanha' }, { status: 500 })
  }
}
