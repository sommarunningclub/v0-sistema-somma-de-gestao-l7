'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type { AudienceIndividual } from '@/lib/email/types'

interface Pessoa {
  nome: string | null
  email: string
}

interface EmailIndividualPickerProps {
  value: AudienceIndividual[]
  onChange: (next: AudienceIndividual[]) => void
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function EmailIndividualPicker({ value, onChange }: EmailIndividualPickerProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Pessoa[]>([])
  // Contador de requisição: capturado antes do await e conferido depois, para
  // que uma resposta lenta de uma busca antiga não sobrescreva o resultado de
  // uma busca mais nova (mesmo padrão de email-audience-picker.tsx).
  const requestIdRef = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      requestIdRef.current += 1 // invalida qualquer requisição em voo
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      try {
        const res = await apiFetch(`/api/email-audiences/pessoas?q=${encodeURIComponent(term)}`)
        if (requestId !== requestIdRef.current) return // resposta desatualizada — ignora
        if (!res.ok) {
          setSuggestions([])
          return
        }
        const data = await res.json()
        if (requestId !== requestIdRef.current) return
        setSuggestions(data.data ?? [])
      } catch {
        if (requestId === requestIdRef.current) setSuggestions([])
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [query])

  const jaEscolhido = (email: string) => value.some((v) => v.email.toLowerCase() === email.toLowerCase())

  const escolhidosLower = new Set(value.map((v) => v.email.toLowerCase()))
  const sugestoesFiltradas = suggestions.filter((s) => !escolhidosLower.has(s.email.toLowerCase()))

  const termoLimpo = query.trim()
  const podeAdicionarDigitado =
    EMAIL_RE.test(termoLimpo) &&
    !jaEscolhido(termoLimpo) &&
    !sugestoesFiltradas.some((s) => s.email.toLowerCase() === termoLimpo.toLowerCase())

  const adicionar = (pessoa: Pessoa) => {
    if (jaEscolhido(pessoa.email)) return
    onChange([...value, { email: pessoa.email, nome: pessoa.nome }])
    setQuery('')
    setSuggestions([])
  }

  const remover = (email: string) => {
    onChange(value.filter((v) => v.email !== email))
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
        />

        {(sugestoesFiltradas.length > 0 || podeAdicionarDigitado) && (
          <div className="absolute z-10 mt-1 w-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden shadow-lg">
            {podeAdicionarDigitado && (
              <button
                type="button"
                onClick={() => adicionar({ email: termoLimpo, nome: null })}
                className="w-full text-left px-3 py-2 text-sm text-orange-400 hover:bg-neutral-800 transition-colors"
              >
                Adicionar {termoLimpo}
              </button>
            )}
            {sugestoesFiltradas.map((s) => (
              <button
                key={s.email}
                type="button"
                onClick={() => adicionar(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors"
              >
                <span className="text-white">{s.nome ?? s.email}</span>
                {s.nome && <span className="text-neutral-400"> — {s.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((pessoa) => (
            <li
              key={pessoa.email}
              className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-full pl-3 pr-1.5 py-1 text-sm"
            >
              <span className="text-white">{pessoa.nome ?? pessoa.email}</span>
              {pessoa.nome && <span className="text-neutral-400">({pessoa.email})</span>}
              <button
                type="button"
                aria-label={`Remover ${pessoa.nome ?? pessoa.email}`}
                onClick={() => remover(pessoa.email)}
                className="text-neutral-400 hover:text-orange-500 transition-colors rounded-full p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
