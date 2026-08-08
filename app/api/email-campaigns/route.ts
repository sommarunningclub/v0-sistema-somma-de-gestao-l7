import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/api-auth'
import { createCampaign, getCampaigns } from '@/lib/services/email-campaigns'
import { TEMPLATE_KEYS } from '@/lib/email/templates'
import { isAudienceKey } from '@/lib/email/audiences'

// `z.string().url()` sozinho aceita qualquer esquema reconhecido pela URL()
// do WHATWG, inclusive `javascript:`. Como `escapeHtml` (lib/email/templates)
// não bloqueia esse esquema em CTA/imagem, a validação é feita aqui, na
// fronteira de entrada: só aceitamos URLs http/https.
const httpUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'A URL deve começar com http:// ou https://',
  })

const audienceSchema = z.object({
  bases: z
    .array(
      z.object({
        key: z.string().refine(isAudienceKey, { message: 'Base desconhecida' }),
        filtros: z.record(z.string()).default({}),
      }),
    )
    .min(1, 'Selecione ao menos uma base'),
})

const createSchema = z.object({
  nome: z.string().min(2, 'Nome muito curto').max(120),
  template_key: z.enum(TEMPLATE_KEYS),
  subject: z.string().min(2, 'Assunto muito curto').max(200),
  preheader: z.string().max(200).nullable().optional(),
  content: z.object({
    titulo: z.string().min(1, 'Título obrigatório').max(200),
    texto: z.string().min(1, 'Texto obrigatório').max(5000),
    imagem_url: httpUrlSchema.optional(),
    data: z.string().max(120).optional(),
    local: z.string().max(200).optional(),
  }),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url: httpUrlSchema.nullable().optional(),
  audience: audienceSchema,
  scheduled_at: z.string().datetime().nullable().optional(),
})

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
