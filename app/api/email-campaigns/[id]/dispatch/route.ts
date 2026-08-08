import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, updateCampaign } from '@/lib/services/email-campaigns'
import { dispatchSlice, prepareCampaign } from '@/lib/email/dispatch'

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

    if (result.remaining === 0) {
      await updateCampaign(id, { status: 'enviada', finished_at: new Date().toISOString() })
    }

    return NextResponse.json({ ...result, total: prepared.total })
  } catch (err) {
    console.error('[email-campaigns/dispatch] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao disparar campanha' }, { status: 500 })
  }
}
