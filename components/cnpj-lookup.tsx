'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, CheckCircle2, Search } from 'lucide-react'
import type { CNPJData } from '@/lib/services/partners'
import { apiFetch } from '@/lib/api-client'
import { SectionTitle, Skeleton, Well, notify } from '@/components/somma'

interface CNPJLookupProps {
  onDataLoaded: (data: CNPJData) => void
  onLoading: (loading: boolean) => void
  onError: (error: string | null) => void
}

export function CNPJLookup({ onDataLoaded, onLoading, onError }: CNPJLookupProps) {
  const [cnpj, setCNPJ] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
      setMessage('CNPJ inválido. Digite os 14 dígitos.')
      onError('CNPJ inválido. Digite 14 dígitos.')
      return
    }

    try {
      setIsSearching(true)
      onLoading(true)
      onError(null)
      setMessage(null)
      setSuccess(false)

      const response = await apiFetch(`/api/cnpj?cnpj=${cleanCNPJ}`)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'CNPJ não encontrado')
      }

      const data = await response.json()
      setSuccess(true)
      onDataLoaded(data.company)
      notify.success('Dados da empresa carregados', {
        description: 'Confira e complete os campos preenchidos automaticamente.',
      })

      // Limpar mensagem de sucesso após 2 segundos
      setTimeout(() => setSuccess(false), 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar CNPJ'
      setMessage(errorMessage)
      onError(errorMessage)
      notify.error('Não foi possível buscar o CNPJ', { description: errorMessage })
      console.error('[v0] CNPJ lookup error:', error)
    } finally {
      setIsSearching(false)
      onLoading(false)
    }
  }

  const isComplete = cnpj.replace(/\D/g, '').length === 14
  const hasError = !!message && !success

  return (
    <Well className="p-4 sm:p-5">
      <SectionTitle
        as="h3"
        eyebrow="Preenchimento automático"
        title="Buscar empresa pelo CNPJ"
      />
      <p className="-mt-1 mb-4 text-meta text-ink-muted">
        Informe o CNPJ para carregar razão social, contato e endereço da Receita.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="cnpj-lookup" className="sr-only">
            CNPJ da empresa
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
          />
          <Input
            id="cnpj-lookup"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            aria-invalid={hasError || undefined}
            aria-describedby={message ? 'cnpj-lookup-message' : undefined}
            onChange={(e) => {
              setCNPJ(formatCNPJ(e.target.value))
              setSuccess(false)
              setMessage(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (isComplete && !isSearching) handleSearchCNPJ()
              }
            }}
            className="pl-10 pr-10 font-mono"
            disabled={isSearching}
          />
          {success ? (
            <CheckCircle2
              aria-hidden="true"
              className="absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-success"
            />
          ) : null}
        </div>

        <Button
          type="button"
          onClick={handleSearchCNPJ}
          loading={isSearching}
          disabled={!isComplete}
          className="shrink-0"
        >
          {isSearching ? null : <Search aria-hidden="true" />}
          {isSearching ? 'Buscando…' : 'Buscar dados'}
        </Button>
      </div>

      <p
        id="cnpj-lookup-message"
        role="status"
        aria-live="polite"
        className={`mt-2 flex items-center gap-1.5 text-meta ${
          hasError ? 'text-danger' : 'text-success'
        }`}
      >
        {message ? (
          <>
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {message}
          </>
        ) : success ? (
          <>
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            Dados preenchidos no formulário abaixo.
          </>
        ) : null}
      </p>

      {isSearching ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : null}
    </Well>
  )
}
