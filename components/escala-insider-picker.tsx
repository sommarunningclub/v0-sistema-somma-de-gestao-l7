'use client'

import { useState } from 'react'
import { searchAndRank } from '@/lib/search-utils'
import { SearchInput } from '@/components/somma'
import type { InsiderOption } from '@/lib/types/escala'

interface EscalaInsiderPickerProps {
  insiders: InsiderOption[]
  /** ids já escalados neste evento — ficam desabilitados */
  jaEscalados: string[]
  /** ids marcados agora, para escalar em lote */
  selecionados: string[]
  onAlternar: (insider: InsiderOption) => void
}

export function EscalaInsiderPicker({
  insiders,
  jaEscalados,
  selecionados,
  onAlternar,
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
          const marcado = selecionados.includes(insider.id)
          return (
            <li key={insider.id}>
              <label
                className={[
                  'flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors',
                  escalado
                    ? 'cursor-not-allowed border-transparent text-ink-disabled'
                    : marcado
                      ? 'cursor-pointer border-brand-border bg-brand-soft text-ink-strong'
                      : 'cursor-pointer border-transparent text-ink hover:border-line hover:bg-surface-hover hover:text-ink-strong',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={escalado}
                  onChange={() => onAlternar(insider)}
                  aria-label={
                    escalado
                      ? `${insider.nome} — já escalado neste evento`
                      : `Selecionar ${insider.nome}`
                  }
                  className="h-5 w-5 shrink-0 cursor-pointer rounded border-line-strong bg-surface-sunken accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed"
                />
                <span className="min-w-0 flex-1 truncate">{insider.nome}</span>
                {escalado ? (
                  <span className="shrink-0 text-micro uppercase tracking-wide text-ink-subtle">
                    já escalado
                  </span>
                ) : null}
              </label>
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
