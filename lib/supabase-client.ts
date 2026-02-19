import { createClient as _createClient } from "@supabase/supabase-js"

// Supabase connection - safe initialization without throw
const _url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
const _key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"

export const supabase = _createClient(_url, _key)

export function createClient() {
  return _createClient(_url, _key)
}

export interface CadastroSite {
  id: number
  nome_completo: string
  email: string
  cpf: string
  whatsapp: string
  data_nascimento: string
  cep: number
}

export interface Professor {
  id: string
  name: string
  email: string
  phone: string
  specialty: string
  client_type: string
  status: string
  created_at: string
  updated_at: string
}

export interface ProfessorClient {
  id: string
  professor_id: string
  asaas_customer_id: string
  customer_name: string
  customer_email: string
  customer_cpf_cnpj: string
  status: string
  linked_at: string
  unlinked_at: string | null
}

export interface CommissionConfig {
  id: string
  somma_fixed_fee: number
  updated_by: string
  updated_at: string
}
