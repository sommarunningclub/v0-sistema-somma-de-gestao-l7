'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { matchesTextSearch } from '@/lib/search-utils'
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

  const filtrados = insiders
    .filter((i) => matchesTextSearch(busca, [i.nome]))
    .slice(0, 50)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar insider pelo nome"
          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="max-h-56 overflow-auto space-y-1">
        {filtrados.map((insider) => {
          const escalado = jaEscalados.includes(insider.id)
          return (
            <button
              key={insider.id}
              disabled={escalado}
              onClick={() => onSelecionar(insider)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                escalado
                  ? 'text-neutral-600 cursor-not-allowed'
                  : 'text-neutral-200 hover:bg-neutral-800'
              }`}
            >
              {insider.nome}
              {escalado && <span className="text-xs text-neutral-600 ml-2">já escalado</span>}
            </button>
          )
        })}
        {filtrados.length === 0 && (
          <p className="text-sm text-neutral-500 px-3 py-2">Nenhum insider encontrado.</p>
        )}
      </div>
    </div>
  )
}
