import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export interface Partner {
  id?: string
  cnpj: string
  company_name: string
  company_legal_name?: string
  company_email?: string
  company_phone?: string
  company_address?: string
  company_city?: string
  company_state?: string
  responsible_name: string
  responsible_cpf: string
  responsible_email: string
  responsible_phone: string
  status?: 'active' | 'inactive' | 'pending' | 'negotiating'
  benefit?: string
  benefit_type?: 'percentage' | 'fixed' | 'service' | 'other'
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface CNPJData {
  cnpj: string
  name: string
  legal_name: string
  email: string
  phone: string
  status: string
  address: {
    street: string
    number: string
    complement?: string
    city: string
    state: string
    postal_code: string
  }
}

/**
 * Busca dados da empresa via API ReceitaWS (gratuita, sem bloqueio de CORS)
 * Fallback: BrasilAPI
 */
export const fetchCNPJData = async (cnpj: string): Promise<CNPJData | null> => {
  const cleanCNPJ = cnpj.replace(/\D/g, '')

  if (cleanCNPJ.length !== 14) {
    throw new Error('CNPJ inválido')
  }

  // Tenta primeiro a ReceitaWS (mais confiável em serverless)
  try {
    const response = await fetch(
      `https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        next: { revalidate: 3600 } // Cache por 1 hora
      }
    )

    if (response.ok) {
      const data = await response.json()
      
      if (data.status === 'ERROR') {
        throw new Error(data.message || 'CNPJ não encontrado')
      }

      // Normaliza os dados da ReceitaWS para o formato CNPJData
      return {
        cnpj: data.cnpj?.replace(/\D/g, '') || cleanCNPJ,
        name: data.fantasia || data.nome || '',
        legal_name: data.nome || '',
        email: data.email || '',
        phone: data.telefone || '',
        status: data.situacao || '',
        address: {
          street: data.logradouro || '',
          number: data.numero || '',
          complement: data.complemento || '',
          city: data.municipio || '',
          state: data.uf || '',
          postal_code: data.cep?.replace(/\D/g, '') || ''
        }
      }
    }
  } catch (error) {
    console.log('[v0] ReceitaWS failed, trying BrasilAPI fallback')
  }

  // Fallback: BrasilAPI com headers adequados
  try {
    const response = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SommaApp/1.0)',
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] BrasilAPI error:', response.status, errorText)
      throw new Error(`CNPJ não encontrado (${response.status})`)
    }

    const data = await response.json()
    
    // Normaliza os dados da BrasilAPI
    return {
      cnpj: data.cnpj?.replace(/\D/g, '') || cleanCNPJ,
      name: data.nome_fantasia || data.razao_social || '',
      legal_name: data.razao_social || '',
      email: data.email || '',
      phone: data.ddd_telefone_1 || '',
      status: data.descricao_situacao_cadastral || '',
      address: {
        street: data.logradouro || '',
        number: data.numero || '',
        complement: data.complemento || '',
        city: data.municipio || '',
        state: data.uf || '',
        postal_code: data.cep?.toString() || ''
      }
    }
  } catch (error) {
    console.error('[v0] Error fetching CNPJ data:', error)
    throw error
  }
}

/**
 * Cria um novo parceiro no Supabase
 */
export const createPartner = async (partner: Partner): Promise<Partner | null> => {
  try {
    const { data, error } = await supabase
      .from('partners')
      .insert([partner])
      .select()
      .single()

    if (error) {
      console.error('[v0] Error creating partner:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[v0] Error in createPartner:', error)
    return null
  }
}

/**
 * Busca um parceiro por CNPJ
 */
export const getPartnerByCNPJ = async (cnpj: string): Promise<Partner | null> => {
  try {
    const cleanCNPJ = cnpj.replace(/\D/g, '')

    const { data, error } = await supabase
      .from('partners')
      .select('*')
      .eq('cnpj', cleanCNPJ)
      .maybeSingle()

    if (error) {
      console.error('[v0] Error fetching partner:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[v0] Error in getPartnerByCNPJ:', error)
    return null
  }
}

/**
 * Lista todos os parceiros
 */
export const getAllPartners = async (
  status?: 'active' | 'inactive' | 'pending'
): Promise<Partner[]> => {
  try {
    let query = supabase.from('partners').select('*')

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query.order('created_at', {
      ascending: false
    })

    if (error) {
      console.error('[v0] Error fetching partners:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('[v0] Error in getAllPartners:', error)
    return []
  }
}

/**
 * Atualiza um parceiro
 */
export const updatePartner = async (
  id: string,
  updates: Partial<Partner>
): Promise<Partner | null> => {
  try {
    const { data, error } = await supabase
      .from('partners')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[v0] Error updating partner:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('[v0] Error in updatePartner:', error)
    return null
  }
}

/**
 * Deleta um parceiro
 */
export const deletePartner = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[v0] Error deleting partner:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[v0] Error in deletePartner:', error)
    return false
  }
}
