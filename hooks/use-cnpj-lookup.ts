import { useState, useCallback } from 'react'

export interface CNPJData {
  razao_social: string
  nome_fantasia: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  cep: string
  ddd_telefone_1: string
  email: string | null
  cnpj: string
}

export function useCNPJLookup() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookupCNPJ = useCallback(async (cnpj: string): Promise<CNPJData | null> => {
    // Remove non-digits
    const cleanCNPJ = cnpj.replace(/\D/g, '')

    // Validate length
    if (cleanCNPJ.length !== 14) {
      setError('CNPJ deve ter 14 dígitos')
      return null
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      )

      if (!response.ok) {
        if (response.status === 404) {
          setError('CNPJ não encontrado')
        } else {
          setError('Erro ao buscar dados do CNPJ')
        }
        return null
      }

      const data = await response.json()

      // Extract relevant fields from Brasil API response
      const cnpjData: CNPJData = {
        razao_social: data.razao_social || '',
        nome_fantasia: data.nome_fantasia || data.razao_social || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        municipio: data.municipio || '',
        uf: data.uf || '',
        cep: data.cep || '',
        ddd_telefone_1: data.ddd_telefone_1 || '',
        email: data.email || null,
        cnpj: data.cnpj || cleanCNPJ,
      }

      return cnpjData
    } catch (err) {
      console.error('[v0] CNPJ lookup error:', err)
      setError('Erro ao conectar com a API de CNPJ')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { lookupCNPJ, loading, error }
}
