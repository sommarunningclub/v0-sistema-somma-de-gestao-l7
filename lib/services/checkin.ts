import { cache } from "react"

export interface CheckInData {
  id?: string
  nome?: string
  telefone?: string
  cpf: string
  data: string
  sexo?: string
  pelotao?: string
  nome_do_evento?: string
  validated?: boolean
  validated_at?: string | null
}

interface ApiResponse {
  data?: CheckInData[]
  error?: string
}

/**
 * Busca os dados de check-in da API
 * Sem cache para sempre obter dados atualizados
 */
export const getCheckInData = async (): Promise<CheckInData[]> => {
  try {
    const response = await fetch("/api/checkin", {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error || `API responded with status ${response.status}`)
    }

    const result: ApiResponse = await response.json()
    
    if (result.error) {
      throw new Error(result.error)
    }

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid response format: data is not an array")
    }

    return result.data || []
  } catch (err) {
    console.error("[v0] Error fetching check-in data:", err)
    throw new Error(
      err instanceof Error 
        ? err.message 
        : "Falha ao buscar dados do check-in"
    )
  }
}

/**
 * Formata CPF para exibição
 */
export const formatCPF = (cpf: string): string => {
  if (!cpf) return "-"
  const cleaned = cpf.replace(/\D/g, "")
  if (cleaned.length !== 11) return cpf
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
}

/**
 * Formata telefone para exibição
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return "-"
  const cleaned = phone.replace(/\D/g, "")
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3")
  }
  return phone
}

/**
 * Extrai a parte da data (DD/MM/YYYY) de uma string de data brasileira
 * Formato esperado: "27/01/2026 12:01:17" ou "27/01/2026"
 */
export const extractDatePart = (dateString: string): string => {
  if (!dateString) return ""
  // Pega apenas a parte da data (antes do espaço se houver)
  const datePart = dateString.split(" ")[0].trim()
  return datePart
}

/**
 * Formata data para exibição
 * Aceita formato brasileiro: DD/MM/YYYY ou DD/MM/YYYY HH:MM:SS
 */
export const formatDate = (dateString: string): string => {
  if (!dateString) return "-"
  
  // Extrai apenas a parte da data
  const datePart = extractDatePart(dateString)
  
  // Se já está no formato brasileiro DD/MM/YYYY, retorna diretamente
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
    return datePart
  }
  
  // Se está no formato ISO ou outro, tenta converter
  try {
    const date = new Date(dateString)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    }
  } catch {
    // Ignora erro e retorna string original
  }
  
  return datePart || dateString
}

/**
 * Agrupa check-ins por data
 */
export const groupCheckInsByDate = (data: CheckInData[]): Record<string, CheckInData[]> => {
  return data.reduce(
    (acc, item) => {
      const date = formatDate(item.data)
      if (!acc[date]) {
        acc[date] = []
      }
      acc[date].push(item)
      return acc
    },
    {} as Record<string, CheckInData[]>
  )
}

/**
 * Obtém check-ins do dia atual
 * Compara apenas a parte da data (DD/MM/YYYY)
 */
export const getTodayCheckIns = (data: CheckInData[]): CheckInData[] => {
  const today = new Date()
  const todayString = today.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  
  return data.filter(item => {
    const itemDate = extractDatePart(item.data)
    return itemDate === todayString
  })
}
