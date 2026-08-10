import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import {
  deleteCampaign,
  getCampaignById,
  updateCampaign,
} from '@/lib/services/email-campaigns'
import { campaignFieldsSchema, withContentRules } from '@/lib/email/validation'

// Versão parcial de `campaignFieldsSchema`: todo campo é opcional (é um
// patch), mas quando presente segue as mesmas regras da criação — inclusive
// `httpUrlSchema` para `cta_url`/`content.imagem_url` (bloqueia `javascript:`
// etc., mesma correção aplicada em `POST /api/email-campaigns`). `.strict()`
// rejeita com 400 qualquer chave fora da lista de campos editáveis pelo
// usuário — em especial `status`, `created_by`, `id`, `total_recipients`,
// `started_at`, `finished_at` e `error`, que só podem ser escritos pela
// lógica interna (rotas de dispatch/cancel, cron). `withContentRules` vem
// por último porque `.superRefine` devolve `ZodEffects`, que não tem
// `.partial()`/`.strict()` — e a regra só dispara quando `template_key` E
// `content` vierem juntos no payload (o PATCH é parcial).
const patchSchema = withContentRules(
  campaignFieldsSchema.partial().strict('Campo não permitido em edição de campanha'),
)

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
    const parsed = patchSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const updated = await updateCampaign(id, parsed.data)
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
