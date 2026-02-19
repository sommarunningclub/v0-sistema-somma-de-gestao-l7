'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Loader2, Search, CheckCircle2 } from 'lucide-react'
import type { CNPJData } from '@/lib/services/partners'

interface CNPJLookupProps {
  onDataLoaded: (data: CNPJData) => void
  onLoading: (loading: boolean) => void
  onError: (error: string | null) => void
}

export function CNPJLookup({ onDataLoaded, onLoading, onError }: CNPJLookupProps) {
  const [cnpj, setCNPJ] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [success, setSuccess] = useState(false)

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14)
    if (numbers.length <= 2) return numbers
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`
    if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`
    if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`
  }

  const handleSearchCNPJ = async () => {
    const cleanCNPJ = cnpj.replace(/\D/g, '')

    if (cleanCNPJ.length !== 14) {
      onError('CNPJ inválido. Digite 14 dígitos.')
      return
    }

    try {
      setIsSearching(true)
      onLoading(true)
      onError(null)
      setSuccess(false)

      const response = await fetch(`/api/cnpj?cnpj=${cleanCNPJ}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'CNPJ não encontrado')
      }

      const data = await response.json()
      setSuccess(true)
      onDataLoaded(data.company)
      
      // Limpar mensagem de sucesso após 2 segundos
      setTimeout(() => setSuccess(false), 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar CNPJ'
      onError(errorMessage)
      console.error('[v0] CNPJ lookup error:', error)
    } finally {
      setIsSearching(false)
      onLoading(false)
    }
  }

  const isComplete = cnpj.replace(/\D/g, '').length === 14

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Buscar Empresa</h3>
        <p className="text-xs md:text-sm text-neutral-400 mb-4">Insira o CNPJ para carregar os dados da empresa automaticamente</p>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-orange-500" />
          <Input
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => {
              setCNPJ(formatCNPJ(e.target.value))
              setSuccess(false)
            }}
            onKeyDown={(e) => e.key === 'Enter' && isComplete && handleSearchCNPJ()}
            className="pl-11 pr-4 py-3 md:py-3.5 bg-neutral-800 border-neutral-600 text-white placeholder-neutral-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-all text-sm md:text-base"
            disabled={isSearching}
          />
          {success && (
            <CheckCircle2 className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-400" />
          )}
        </div>

        <Button
          onClick={handleSearchCNPJ}
          disabled={isSearching || !isComplete}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-semibold py-3 md:py-3.5 transition-all duration-200"
        >
          {isSearching ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              <span>Buscando CNPJ...</span>
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              <span>Buscar Dados da Empresa</span>
            </>
          )}
        </Button>
      </div>

      <p className="text-xs text-neutral-500 text-center mt-4">
        Os dados serão preenchidos automaticamente no formulário
      </p>
    </div>
  )
}
