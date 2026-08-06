"use client"

import { useCallback, useState } from 'react'

export type EnderecoCep = {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

type Status = 'idle' | 'loading' | 'error'

/** Autofill de endereço via BrasilAPI (mesmo endpoint do checkout do site). */
export function useCepLookup() {
  const [status, setStatus] = useState<Status>('idle')

  const buscar = useCallback(async (cep: string): Promise<EnderecoCep | null> => {
    const digits = (cep || '').replace(/\D/g, '')
    if (digits.length !== 8) return null

    setStatus('loading')
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`)
      if (!res.ok) throw new Error('cep')
      const data = await res.json()
      setStatus('idle')
      return {
        logradouro: data.street || '',
        bairro: data.neighborhood || '',
        cidade: data.city || '',
        estado: data.state || '',
      }
    } catch {
      setStatus('error')
      return null
    }
  }, [])

  return { status, buscar }
}
