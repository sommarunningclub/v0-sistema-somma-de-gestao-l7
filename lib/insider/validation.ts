import { z } from 'zod'

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '')
}

// ---------- CPF ----------

export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (factor: number) => {
    let sum = 0
    for (let i = 0; i < factor - 1; i++) sum += Number(cpf[i]) * (factor - i)
    const rest = (sum * 10) % 11
    return rest === 10 ? 0 : rest
  }
  return calc(10) === Number(cpf[9]) && calc(11) === Number(cpf[10])
}

// ---------- Data ----------

export function maskDate(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

export function isValidBirthDate(value: string): boolean {
  const m = (value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return false
  const day = Number(m[1])
  const month = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  if (year < 1900 || year > new Date().getFullYear()) return false
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  )
}

/** DD/MM/AAAA -> AAAA-MM-DD (coluna date) */
export function brDateToISO(value: string): string | null {
  const m = (value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

/** AAAA-MM-DD (ou timestamp ISO) -> DD/MM/AAAA */
export function isoToBrDate(value: string | null | undefined): string {
  if (!value) return ''
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

// ---------- Outras máscaras ----------

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5)}`
}

export function maskPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function maskUf(value: string): string {
  return (value || '').replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
}

// ---------- Schema ----------

export const insiderFormSchema = z.object({
  cpf: z.string().trim().refine((v) => isValidCpf(v), 'CPF inválido.'),
  nome: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo.')
    .max(120, 'Nome muito longo.'),
  email: z.string().trim().toLowerCase().email('E-mail inválido.'),
  telefone: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length >= 10, 'WhatsApp inválido.'),
  data_nascimento: z
    .string()
    .trim()
    .refine((v) => isValidBirthDate(v), 'Data de nascimento inválida.'),
  sexo: z
    .string()
    .trim()
    .refine((v) => v === 'masculino' || v === 'feminino', 'Selecione uma opção.'),
  cep: z
    .string()
    .trim()
    .refine((v) => onlyDigits(v).length === 8, 'CEP inválido.'),
  logradouro: z.string().trim().min(3, 'Informe o endereço.').max(160, 'Endereço muito longo.'),
  numero: z.string().trim().min(1, 'Informe o número.').max(20, 'Número muito longo.'),
  complemento: z.string().trim().max(80, 'Complemento muito longo.'),
  bairro: z.string().trim().min(2, 'Informe o bairro.').max(80, 'Bairro muito longo.'),
  cidade: z.string().trim().min(2, 'Informe a cidade.').max(80, 'Cidade muito longa.'),
  estado: z
    .string()
    .trim()
    .refine((v) => /^[A-Za-z]{2}$/.test(v), 'UF inválida.'),
  consent_lgpd: z
    .boolean()
    .refine((v) => v === true, 'É preciso aceitar o Termo de Consentimento de Dados (LGPD).'),
  consent_imagem: z
    .boolean()
    .refine((v) => v === true, 'É preciso aceitar o Termo de Uso de Imagem.'),
})

export type InsiderFormInput = z.infer<typeof insiderFormSchema>

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Verifique os dados informados.'
}

/**
 * Regra de senha compartilhada client/server.
 * `obrigatoria` = true quando o insider ainda não tem credencial salva.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export function validateSenha(
  senha: string,
  confirmacao: string,
  obrigatoria: boolean
): string | null {
  if (!senha) {
    return obrigatoria ? 'Crie uma senha de acesso.' : null
  }
  if (senha.length < 8) return 'A senha deve ter ao menos 8 caracteres.'
  if (senha !== confirmacao) return 'As senhas não conferem.'
  return null
}
