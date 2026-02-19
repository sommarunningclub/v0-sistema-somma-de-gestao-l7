import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a singleton Supabase client
let supabaseInstance: ReturnType<typeof createSupabaseClient> | null = null;

function getSupabaseInstance() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('[v0] Supabase credentials missing:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseKey,
      url: supabaseUrl?.substring(0, 20) + '...'
    });
    throw new Error(
      "Missing Supabase credentials. Please check your environment variables."
    );
  }

  if (!supabaseInstance) {
    supabaseInstance = createSupabaseClient(supabaseUrl, supabaseKey);
  }

  return supabaseInstance;
}

// Export the client - will throw error only when actually used
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    const instance = getSupabaseInstance();
    const value = instance[prop as keyof typeof instance];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

// Export a function to create new Supabase clients
export function createClient() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase credentials. Please check your environment variables."
    );
  }
  return createSupabaseClient(supabaseUrl, supabaseKey);
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
};

export type CommissionConfig = {
  id: string;
  somma_fixed_fee: number;
  updated_at: string;
  updated_by: string | null;
};
