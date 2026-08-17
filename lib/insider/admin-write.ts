import { brDateToISO } from './validation'
import { pickInsiderFields } from '@/lib/api/writable-fields'

export class InsiderWriteError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsiderWriteError'
  }
}

/**
 * Idade em anos completos a partir de `YYYY-MM-DD`. Usa calendário local
 * para não recuar um dia no fuso de São Paulo.
 */
export function idadeDeNascimento(value: string | null | undefined): number | null {
  const m = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const ano = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])
  if (!ano || !mes || !dia) return null

  const hoje = new Date()
  let idade = hoje.getFullYear() - ano
  const mesAtual = hoje.getMonth() + 1
  const diaAtual = hoje.getDate()
  if (mesAtual < mes || (mesAtual === mes && diaAtual < dia)) idade -= 1
  return idade >= 0 && idade < 130 ? idade : null
}

function normalizarDataNascimento(value: unknown): string | null {
  if (value == null) return null
  const texto = String(value).trim()
  if (!texto) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)
  const iso = brDateToISO(texto)
  if (!iso) {
    throw new InsiderWriteError('Data de nascimento inválida. Use DD/MM/AAAA.')
  }
  return iso
}

/**
 * Whitelist + conversões do admin. `data_nascimento` aceita vazio (grava
 * null), ISO ou DD/MM/AAAA. `ativo` vira boolean. Consentimentos e id
 * nunca passam — a whitelist já os descarta.
 */
export function prepareInsiderWrite(body: unknown): Record<string, unknown> {
  const fields = pickInsiderFields(body)

  if ('data_nascimento' in fields) {
    fields.data_nascimento = normalizarDataNascimento(fields.data_nascimento)
  }

  if ('ativo' in fields) {
    fields.ativo = fields.ativo === true || fields.ativo === 'true'
  }

  return fields
}
