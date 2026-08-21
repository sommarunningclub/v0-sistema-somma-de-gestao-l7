// Códigos que liberam o Pix Automático no checkout do site (sommaclub.com.br).
//
// Regra comercial: o Pix Automático aparece no checkout do plano Mensal mas
// fica bloqueado. A meta é levar o máximo de clientes para o cartão e liberar
// o débito automático caso a caso, para quem procura o atendimento.
//
// A tabela `pix_automatico_tokens` vive no mesmo Supabase do site: aqui o
// painel gera e acompanha os códigos, e o checkout consome.

export const TABELA_TOKENS = "pix_automatico_tokens"
export const VALIDADE_HORAS = 24

// Sem I, O, 0 e 1: o código é ditado por telefone/WhatsApp e esses caracteres
// se confundem entre si.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// Valida o formato XXXX-XXXX no alfabeto acima. As rotas por código usam isto
// antes de tocar o banco: o valor vem da URL e não precisa chegar à query se
// nem tem cara de código.
export function codigoValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(valor)
}

export function gerarCodigo(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const s = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("")
  return `${s.slice(0, 4)}-${s.slice(4, 8)}`
}

export interface PixAutomaticoToken {
  codigo: string
  criado_em: string
  expira_em: string
  usado_em: string | null
  usado_por_nome: string | null
  observacao: string | null
  criado_por: string | null
}
