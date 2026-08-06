"use client"

import { memo, useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

interface MembersSearchBarProps {
  /** Chamado com o termo já "debounced". Deve ser estável (useCallback). */
  onSearch: (term: string) => void
  isSearching?: boolean
  delay?: number
}

/**
 * Campo de busca isolado: mantém o valor digitado em estado LOCAL e só
 * notifica o pai depois do debounce. Como o pai não re-renderiza a cada
 * tecla, a lista de membros não trava e nenhum caractere é descartado.
 */
function MembersSearchBarComponent({ onSearch, isSearching = false, delay = 350 }: MembersSearchBarProps) {
  const [value, setValue] = useState("")

  // Mantém a callback mais recente sem reagendar o debounce a cada render do pai.
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(value.trim())
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
      <Input
        type="search"
        inputMode="search"
        placeholder="Nome, email, CPF ou WhatsApp..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        className="pl-10 pr-10 w-full bg-neutral-800 border-neutral-600 text-white placeholder-neutral-400 text-xs sm:text-sm rounded-lg"
      />
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  )
}

export const MembersSearchBar = memo(MembersSearchBarComponent)
