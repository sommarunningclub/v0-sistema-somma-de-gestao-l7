import { z } from 'zod'
import { TEMPLATE_KEYS } from './templates'
import { isAudienceKey } from './audiences'

/**
 * `z.string().url()` sozinho aceita qualquer esquema reconhecido pela URL()
 * do WHATWG, inclusive `javascript:`. Como `escapeHtml` (lib/email/templates)
 * não bloqueia esse esquema em CTA/imagem, a validação é feita aqui, na
 * fronteira de entrada: só aceitamos URLs http/https. Usado tanto na
 * criação (`POST /api/email-campaigns`) quanto na edição
 * (`PATCH /api/email-campaigns/[id]`), para que os dois caminhos fiquem
 * sempre em sincronia.
 */
export const httpUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
    message: 'A URL deve começar com http:// ou https://',
  })

const individualSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().max(120).nullable().default(null),
})

export const audienceSchema = z
  .object({
    bases: z
      .array(
        z.object({
          key: z.string().refine(isAudienceKey, { message: 'Base desconhecida' }),
          filtros: z.record(z.string()).default({}),
        }),
      )
      .default([]),
    individuais: z
      .array(individualSchema)
      .max(50, 'No máximo 50 destinatários individuais')
      .default([]),
  })
  .refine((a) => a.bases.length > 0 || a.individuais.length > 0, {
    message: 'Selecione ao menos uma base ou um destinatário',
  })

/**
 * Campos de campanha editáveis diretamente pelo usuário — usados tanto para
 * criar (`POST`, schema completo) quanto para editar (`PATCH`, versão
 * `.partial()`). Propositalmente NÃO inclui `status`, `created_by`, `id`,
 * `total_recipients`, `started_at`, `finished_at` nem `error`: esses campos
 * são geridos internamente pelas rotas de dispatch/cancel e pelo cron, nunca
 * por edição direta do usuário.
 */
export const campaignFieldsSchema = z.object({
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
