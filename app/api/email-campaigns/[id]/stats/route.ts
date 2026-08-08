import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  getCampaignClickedLinks,
  getCampaignEventSeries,
  getCampaignRecipients,
  getCampaignStats,
} from '@/lib/services/email-campaigns'
import type { RecipientStatus } from '@/lib/email/types'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const statusParam = req.nextUrl.searchParams.get('status') as RecipientStatus | null

  const [stats, recipients, links, dailySeries] = await Promise.all([
    getCampaignStats(id),
    getCampaignRecipients(id, statusParam ?? undefined),
    getCampaignClickedLinks(id),
    getCampaignEventSeries(id),
  ])

  if (!stats) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  return NextResponse.json({ stats, recipients, links, daily_series: dailySeries })
}
