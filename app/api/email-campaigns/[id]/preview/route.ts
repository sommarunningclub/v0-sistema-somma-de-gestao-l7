import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { getCampaignById } from '@/lib/services/email-campaigns'
import { renderTemplate } from '@/lib/email/templates'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  const html = renderTemplate({
    templateKey: campaign.template_key,
    subject: campaign.subject,
    preheader: campaign.preheader,
    content: campaign.content,
    ctaLabel: campaign.cta_label,
    ctaUrl: campaign.cta_url,
    nome: 'Ana',
    unsubscribeUrl: '#',
  })

  return NextResponse.json({ html })
}
