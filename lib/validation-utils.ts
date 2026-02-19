import { createClient } from '@/lib/supabase-client'

interface CheckInData {
  nome: string
  telefone: string
  cpf: string
  data: string
  validated?: boolean
  validated_at?: string | null
}

/**
 * Enrich check-in data with validation status from Supabase
 */
/**
 * Format CPF with mask: XXX.XXX.XXX-XX
 */
function formatCPF(cpf: string): string {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return cpf
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`
}

export async function enrichWithValidationData(data: CheckInData[]): Promise<CheckInData[]> {
  try {
    const supabase = createClient()
    
    // Extrair todos os CPFs únicos e formatá-los para o padrão do Supabase (XXX.XXX.XXX-XX)
    const cpfsFormatted = [...new Set(data.map(item => formatCPF(item.cpf)))]
    
    if (cpfsFormatted.length === 0) {
      return data
    }

    // Buscar validações do Supabase usando CPFs formatados
    const { data: validations, error } = await supabase
      .from('checkins')
      .select('cpf, validated, validated_at')
      .in('cpf', cpfsFormatted)
    
    if (error) {
      console.error('[v0] enrichWithValidationData: Error fetching validations:', error)
      return data
    }

    // Criar um mapa de validações por CPF (usando CPF limpo como chave)
    const validationMap = new Map<string, { validated: boolean; validated_at: string | null }>()
    
    if (validations) {
      for (const validation of validations) {
        // Usar CPF limpo como chave do mapa para facilitar correspondência
        const cleanCpf = validation.cpf?.replace(/\D/g, '') || ''
        validationMap.set(cleanCpf, {
          validated: validation.validated || false,
          validated_at: validation.validated_at || null
        })
      }
    }

    // Enriquecer os dados com as informações de validação
    const enrichedData = data.map(item => {
      // Comparar usando CPF limpo
      const cleanCpf = item.cpf.replace(/\D/g, '')
      const validation = validationMap.get(cleanCpf)
      
      return {
        ...item,
        validated: validation?.validated || false,
        validated_at: validation?.validated_at || null
      }
    })

    return enrichedData
  } catch (error) {
    console.error('[v0] enrichWithValidationData: Caught error:', error)
    return data
  }
}
