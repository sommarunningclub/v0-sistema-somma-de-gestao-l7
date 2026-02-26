import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

// Initialize only once
function initSupabase() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  console.log('[v0] Supabase initialization check:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlPrefix: supabaseUrl?.substring(0, 30) || 'MISSING',
    keyPrefix: supabaseKey?.substring(0, 20) || 'MISSING'
  });

  if (!supabaseUrl || !supabaseKey) {
    console.error('[v0] ERROR: Supabase credentials are missing!');
    console.error('[v0] NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT SET');
    console.error('[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
  }

  // Create Supabase client singleton
  supabaseInstance = createSupabaseClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder-key'
  );

  return supabaseInstance;
}

// Export the singleton instance
export const supabase = initSupabase();

// Export a function to get the Supabase client (always returns the same instance)
export function createClient() {
  return supabase;
}

export type CadastroSite = {
  id: number;
  nome_completo: string;
  email: string;
  cpf: string;
  data_nascimento: string;
  whatsapp: string;
};

export type Coupon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CouponRedemption = {
  id: string;
  coupon_id: string;
  customer_email: string;
  customer_name: string | null;
  original_value: number;
  discount_applied: number;
  final_value: number;
  redeemed_at: string;
};

export type Professor = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  status: "active" | "inactive";
  client_type: "cliente_somma" | "cliente_professor";
  created_at: string;
  updated_at: string;
};

export type ProfessorClient = {
  id: string;
  professor_id: string;
  asaas_customer_id: string;
  customer_name: string;
  customer_email: string;
  status: "active" | "inactive";
  linked_at: string;
  unlinked_at: string | null;
  tag?: string;
};

export type CommissionConfig = {
  id: string;
  somma_fixed_fee: number;
  updated_at: string;
  updated_by: string | null;
};

export type ProfessorRepasseSetting = {
  id: string;
  professor_id: string;
  enable_repasse: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
