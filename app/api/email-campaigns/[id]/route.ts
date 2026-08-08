import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  deleteCampaign,
  getCampaignById,
  updateCampaign,
} from '@/lib/services/email-campaigns'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const existing = await getCampaignById(id)
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (existing.status === 'enviando' || existing.status === 'enviada') {
    return NextResponse.json(
      { error: 'Não é possível editar uma campanha já disparada' },
      { status: 409 },
    )
  }

  try {
    const patch = await req.json()
    const updated = await updateCampaign(id, patch)
    if (!updated) return NextResponse.json({ error: 'Erro ao atualizar campanha' }, { status: 500 })
    return NextResponse.json(updated)
  } catch (err) {
    console.error('[email-campaigns/[id]] PATCH exception:', err)
    return NextResponse.json({ error: 'Erro ao atualizar campanha' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const existing = await getCampaignById(id)
  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (existing.status === 'enviando') {
    return NextResponse.json(
      { error: 'Cancele a campanha antes de excluí-la' },
      { status: 409 },
    )
  }

  const ok = await deleteCampaign(id)
  if (!ok) return NextResponse.json({ error: 'Erro ao excluir campanha' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
