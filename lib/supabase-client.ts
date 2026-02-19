// Supabase Client - v3.0 - Clean rebuild
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Create the Supabase client - never throws, fails gracefully on API calls
export const supabase = createSupabaseClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
)

// Export createClient for server-side usage
export function createClient() {
  return createSupabaseClient(
    supabaseUrl || "https://placeholder.supabase.co",
    supabaseAnonKey || "placeholder-key"
  )
}

// Type exports
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
