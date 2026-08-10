import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { createCampaign, getCampaigns } from '@/lib/services/email-campaigns'
import { campaignFieldsSchema, withContentRules } from '@/lib/email/validation'

// Schema completo de criação — todos os campos editáveis são obrigatórios
// (exceto os já opcionais/nullable dentro de `campaignFieldsSchema`).
// Compartilha `httpUrlSchema`/`audienceSchema` com o schema de edição
// (`app/api/email-campaigns/[id]/route.ts`) via `lib/email/validation.ts`,
// para que a validação de URL (bloqueio de `javascript:` etc.) não fique
// duplicada nem possa divergir entre criação e edição. `withContentRules`
// exige `titulo`/`texto` ou `html` conforme o `template_key` — aplicado por
// último porque `.superRefine` devolve `ZodEffects`.
const createSchema = withContentRules(campaignFieldsSchema)

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    return NextResponse.json(await getCampaigns())
  } catch (err) {
    console.error('[email-campaigns] GET exception:', err)
    return NextResponse.json({ error: 'Erro ao listar campanhas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'email')
  if (auth instanceof NextResponse) return auth

  try {
    const parsed = createSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const campaign = await createCampaign({ ...parsed.data, created_by: auth.session.sub })
    if (!campaign) return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 })

    return NextResponse.json(campaign, { status: 201 })
  } catch (err) {
    console.error('[email-campaigns] POST exception:', err)
    return NextResponse.json({ error: 'Erro ao criar campanha' }, { status: 500 })
  }
}
