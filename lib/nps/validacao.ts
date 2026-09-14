import { z } from 'zod'

/**
 * Validação das rotas do módulo NPS. Os CHECKs do banco repetem as regras que
 * importam (slug, janela sem sobreposição, tratativa coerente); aqui elas
 * chegam antes, com mensagem legível.
 */

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const REFERENCIA_RE = /^\d{4}-B[1-6]$/

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'O código do link precisa ter pelo menos 3 caracteres.')
  .max(60, 'O código do link pode ter até 60 caracteres.')
  .regex(SLUG_RE, 'Use só letras minúsculas, números e hífens no código do link.')
  .refine((s) => s !== 'convite', 'Este código é reservado. Escolha outro.')

const tituloSchema = z
  .string()
  .trim()
  .min(3, 'Dê um título para a rodada.')
  .max(120, 'O título pode ter até 120 caracteres.')

const referenciaSchema = z.string().regex(REFERENCIA_RE, 'Escolha o bimestre da rodada.')
const dataSchema = z.string().datetime({ offset: true, message: 'Data inválida.' })

export const criarRodadaSchema = z
  .object({
    title: tituloSchema,
    slug: slugSchema,
    reference_period: referenciaSchema,
    opens_at: dataSchema,
    closes_at: dataSchema,
    publicar: z.boolean().default(false),
  })
  .refine((d) => new Date(d.closes_at) > new Date(d.opens_at), {
    message: 'O fechamento precisa ser depois da abertura.',
    path: ['closes_at'],
  })

export type CriarRodadaInput = z.infer<typeof criarRodadaSchema>

export const acoesRodada = ['publicar', 'encerrar', 'reabrir', 'voltar_rascunho'] as const
export type AcaoRodada = (typeof acoesRodada)[number]

export const atualizarRodadaSchema = z
  .object({
    title: tituloSchema.optional(),
    slug: slugSchema.optional(),
    reference_period: referenciaSchema.optional(),
    opens_at: dataSchema.optional(),
    closes_at: dataSchema.optional(),
    acao: z.enum(acoesRodada).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nada para alterar.' })

export type AtualizarRodadaInput = z.infer<typeof atualizarRodadaSchema>

export const statusTratativa = ['pending', 'in_progress', 'resolved', 'no_action'] as const

export const salvarTratativaSchema = z
  .object({
    status: z.enum(statusTratativa).optional(),
    owner_name: z
      .string()
      .trim()
      .max(120, 'O nome do responsável pode ter até 120 caracteres.')
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),
    note: z
      .string()
      .trim()
      .max(4000, 'A anotação pode ter até 4000 caracteres.')
      .transform((v) => (v === '' ? undefined : v))
      .optional(),
  })
  .refine((d) => d.status !== undefined || d.owner_name !== undefined || d.note !== undefined, {
    message: 'Nada para salvar.',
  })

export type SalvarTratativaInput = z.infer<typeof salvarTratativaSchema>

export const uuidSchema = z.string().uuid('Identificador inválido.')

const SO_LETRAS = /^[\p{L}\p{M}'’.\- ]+$/u

/** Mesma regra da pesquisa no site: só letras, pelo menos duas. */
function parteDoNome(rotulo: string, max: number) {
  return z
    .string()
    .transform((v) => v.normalize('NFC').replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(1, `Informe o ${rotulo}.`)
        .max(max, `O ${rotulo} pode ter até ${max} caracteres.`)
        .regex(SO_LETRAS, `Use apenas letras no ${rotulo}.`)
        .refine((v) => v.replace(/[^\p{L}]/gu, '').length >= 2, `Escreva o ${rotulo} completo.`),
    )
}

/**
 * Correção feita no painel: quem respondeu e qual o professor. Notas e textos
 * são do aluno e não se editam; mudar uma nota falsearia o NPS.
 */
export const editarRespostaSchema = z
  .object({
    first_name: parteDoNome('nome', 60).optional(),
    last_name: parteDoNome('sobrenome', 80).optional(),
    professor_id: z.string().uuid('Professor inválido.').nullable().optional(),
  })
  .refine((d) => d.first_name !== undefined || d.last_name !== undefined || d.professor_id !== undefined, {
    message: 'Nada para alterar.',
  })

export type EditarRespostaInput = z.infer<typeof editarRespostaSchema>
