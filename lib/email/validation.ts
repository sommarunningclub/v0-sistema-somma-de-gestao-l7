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
    // `titulo`/`texto` são obrigatórios para os templates padrão e
    // dispensados para `html_custom` — a regra por tipo vive em
    // `withContentRules`, aplicada depois de `.partial()`/`.strict()` em
    // cada call site (ver comentário abaixo).
    titulo: z.string().max(200).optional(),
    texto: z.string().max(5000).optional(),
    imagem_url: httpUrlSchema.optional(),
    data: z.string().max(120).optional(),
    local: z.string().max(200).optional(),
    html: z.string().max(100_000, 'O HTML deve ter no máximo 100 KB').optional(),
  }),
  cta_label: z.string().max(80).nullable().optional(),
  cta_url: httpUrlSchema.nullable().optional(),
  audience: audienceSchema,
  scheduled_at: z.string().datetime().nullable().optional(),
})

/**
 * Exige os campos certos conforme o template: `html` para `html_custom`,
 * `titulo`/`texto` para os demais. Aplicar por último em cada call site,
 * depois de qualquer `.partial()`/`.strict()` — `.superRefine` devolve
 * `ZodEffects`, que não tem esses métodos, por isso a regra não pode viver
 * dentro de `campaignFieldsSchema` (que precisa continuar sendo um
 * `ZodObject` puro para a rota de PATCH poder chamar `.partial().strict()`).
 */
export function withContentRules<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data: any, ctx: z.RefinementCtx) => {
    // Só valida a combinação quando o template veio no payload (o PATCH é parcial).
    if (data?.template_key && data?.content) {
      if (data.template_key === 'html_custom') {
        if (!data.content.html?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['content', 'html'],
            message: 'Envie um arquivo HTML',
          })
        }
        return
      }

      if (!data.content.titulo?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'titulo'], message: 'Título obrigatório' })
      }
      if (!data.content.texto?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['content', 'texto'], message: 'Texto obrigatório' })
      }
      return
    }

    // PATCH parcial: `content` pode vir sem `template_key` (ou vice-versa).
    // Ainda assim, se `content` veio no payload, ele precisa resolver para um
    // corpo válido — `html` OU `titulo`+`texto` — senão um PATCH parcial como
    // `{"content":{}}` grava um conteúdo vazio por cima do que já existia,
    // deixando a campanha presa em "enviando" quando o disparo tentar
    // renderizar um template sem título/texto (ver validation.ts históricos).
    if (data?.content !== undefined) {
      const hasHtml = !!data.content?.html?.trim()
      const hasTituloTexto = !!data.content?.titulo?.trim() && !!data.content?.texto?.trim()
      if (!hasHtml && !hasTituloTexto) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['content'],
          message: 'Conteúdo incompleto: envie html ou título e texto',
        })
      }
    }
  })
}
