'use client'

import { useState } from 'react'
import { searchAndRank } from '@/lib/search-utils'
import { SearchInput } from '@/components/somma'
import type { InsiderOption } from '@/lib/types/escala'

interface EscalaInsiderPickerProps {
  insiders: InsiderOption[]
  /** ids já escalados neste evento — ficam desabilitados */
  jaEscalados: string[]
  onSelecionar: (insider: InsiderOption) => void
}

export function EscalaInsiderPicker({
  insiders,
  jaEscalados,
  onSelecionar,
}: EscalaInsiderPickerProps) {
  const [busca, setBusca] = useState('')

  // Ordenado por relevância antes de cortar em 50: sem isso, o corte poderia
  // descartar justamente o insider procurado.
  const filtrados = searchAndRank(insiders, busca, (i) => [i.nome]).slice(0, 50)

  return (
    <div className="space-y-2">
      <SearchInput
        value={busca}
        onValueChange={setBusca}
        label="Buscar insider pelo nome"
        placeholder="Buscar insider pelo nome"
        className="sm:max-w-none"
      />

      <ul
        aria-label="Insiders disponíveis"
        className="scroll-touch max-h-64 space-y-1 overflow-y-auto"
      >
        {filtrados.map((insider) => {
          const escalado = jaEscalados.includes(insider.id)
          return (
            <li key={insider.id}>
              <button
                type="button"
                disabled={escalado}
                onClick={() => onSelecionar(insider)}
                aria-label={
                  escalado
                    ? `${insider.nome} — já escalado neste evento`
                    : `Escalar ${insider.nome}`
                }
                className={[
                  'ds-tap flex w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                  escalado
                    ? 'cursor-not-allowed text-ink-disabled'
                    : 'text-ink hover:bg-surface-hover hover:text-ink-strong',
                ].join(' ')}
              >
                <span className="truncate">{insider.nome}</span>
                {escalado ? (
                  <span className="shrink-0 text-micro uppercase tracking-wide text-ink-subtle">
                    já escalado
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        {filtrados.length === 0 ? (
          <li className="px-3 py-2 text-meta text-ink-muted">
            {busca
              ? `Nenhum insider corresponde a “${busca}”.`
              : 'Nenhum insider disponível.'}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
