"use client"

import { memo, useEffect, useRef, useState } from "react"
import { SearchInput } from "@/components/somma"

interface MembersSearchBarProps {
  /** Chamado com o termo já "debounced". Deve ser estável (useCallback). */
  onSearch: (term: string) => void
  isSearching?: boolean
  delay?: number
  className?: string
}

/**
 * Campo de busca isolado: mantém o valor digitado em estado LOCAL e só
 * notifica o pai depois do debounce. Como o pai não re-renderiza a cada
 * tecla, a lista de membros não trava e nenhum caractere é descartado.
 */
function MembersSearchBarComponent({
  onSearch,
  isSearching = false,
  delay = 350,
  className,
}: MembersSearchBarProps) {
  const [value, setValue] = useState("")

  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(value.trim())
    }, delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return (
    <div className={className}>
      <SearchInput
        value={value}
        onValueChange={setValue}
        label="Buscar membros"
        placeholder="Nome, e-mail, CPF ou WhatsApp..."
        placeholderShort="Nome, CPF ou e-mail"
        aria-busy={isSearching || undefined}
      />
      <span aria-live="polite" className="sr-only">
        {isSearching ? "Buscando membros..." : ""}
      </span>
    </div>
  )
}

export const MembersSearchBar = memo(MembersSearchBarComponent)
