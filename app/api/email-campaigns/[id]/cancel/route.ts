import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById, updateCampaign } from '@/lib/services/email-campaigns'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (campaign.status === 'enviada') {
    return NextResponse.json({ error: 'Campanha já foi enviada' }, { status: 409 })
  }

  const updated = await updateCampaign(id, {
    status: 'cancelada',
    finished_at: new Date().toISOString(),
  })

  if (!updated) return NextResponse.json({ error: 'Erro ao cancelar' }, { status: 500 })
  return NextResponse.json(updated)
}
