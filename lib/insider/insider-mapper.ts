import {
  brDateToISO,
  isoToBrDate,
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
  type InsiderFormInput,
} from './validation'

/** Colunas devolvidas ao browser. Nunca inclui senha nem benefícios. */
export const INSIDER_PUBLIC_COLUMNS =
  'id, nome, email, telefone, data_nascimento, sexo, cep, logradouro, numero, complemento, bairro, cidade, estado, tamanho_camisa, foto_url'

export type InsiderPublic = {
  id: string
  nome: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  tamanho_camisa: string
  foto_url: string
  tem_senha: boolean
}

/**
 * A base legada tem CPF gravado com e sem máscara.
 * Devolve as duas grafias para usar em `.in('cpf', ...)`.
 */
export function cpfCandidates(cpf: string): string[] {
  const digits = onlyDigits(cpf)
  if (digits.length !== 11) return [digits]
  return [digits, maskCpf(digits)]
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function toInsiderPublic(
  row: Record<string, unknown>,
  temSenha: boolean
): InsiderPublic {
  return {
    id: text(row.id),
    nome: text(row.nome),
    email: text(row.email),
    telefone: text(row.telefone),
    data_nascimento: isoToBrDate(text(row.data_nascimento)),
    sexo: text(row.sexo),
    cep: text(row.cep),
    logradouro: text(row.logradouro),
    numero: text(row.numero),
    complemento: text(row.complemento),
    bairro: text(row.bairro),
    cidade: text(row.cidade),
    estado: text(row.estado),
    tamanho_camisa: text(row.tamanho_camisa),
    foto_url: text(row.foto_url),
    tem_senha: temSenha,
  }
}

/**
 * Campos editáveis do formulário -> colunas de dados_insiders.
 * `cpf` e `foto_url` ficam de fora: a rota decide se insere ou preserva.
 */
export function buildInsiderRow(input: InsiderFormInput): Record<string, unknown> {
  const dataNascimento = brDateToISO(input.data_nascimento)
  if (dataNascimento === null) {
    throw new Error(`data_nascimento malformada: "${input.data_nascimento}" não corresponde ao padrão DD/MM/AAAA`)
  }

  return {
    nome: input.nome.trim(),
    email: input.email.trim().toLowerCase(),
    telefone: maskPhone(input.telefone),
    data_nascimento: dataNascimento,
    sexo: input.sexo,
    cep: maskCep(input.cep),
    logradouro: input.logradouro.trim(),
    numero: input.numero.trim(),
    complemento: input.complemento.trim() || null,
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    estado: input.estado.trim().toUpperCase(),
    tamanho_camisa: input.tamanho_camisa.trim().toUpperCase(),
    consent_lgpd: input.consent_lgpd,
    consent_imagem: input.consent_imagem,
  }
}
