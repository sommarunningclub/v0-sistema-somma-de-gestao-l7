'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface MembersStatsCollapsibleProps {
  totalMembers: number
  activeMembers: number
  foundMembers: number
}

export function MembersStatsCollapsible({
  totalMembers,
  activeMembers,
  foundMembers,
}: MembersStatsCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="lg:hidden bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
      {/* Collapsed View - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 p-3 hover:bg-neutral-800 transition-colors active:scale-95"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="text-lg">📊</div>
          <div className="text-left min-w-0">
            <p className="text-xs text-neutral-400 tracking-wider">ESTATÍSTICAS</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-800 rounded text-xs font-bold text-white">
                {totalMembers}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded text-xs font-bold text-green-400">
                {activeMembers}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-500/20 rounded text-xs font-bold text-orange-400">
                {foundMembers}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral-400 transition-transform flex-shrink-0 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-neutral-700 p-3 space-y-3 bg-neutral-800/30 animate-in fade-in slide-in-from-top-2">
          {/* Total Members */}
          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded hover:border-neutral-600 border border-neutral-700 transition-colors">
            <div>
              <p className="text-xs text-neutral-400 tracking-wider mb-1">TOTAL DE MEMBROS</p>
              <p className="text-xl font-bold text-white font-mono">{totalMembers}</p>
            </div>
            <div className="text-2xl">👥</div>
          </div>

          {/* Active Members */}
          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded hover:border-green-600/50 border border-neutral-700 transition-colors">
            <div>
              <p className="text-xs text-neutral-400 tracking-wider mb-1">ATIVOS</p>
              <p className="text-xl font-bold text-green-500 font-mono">{activeMembers}</p>
            </div>
            <div className="text-2xl">✓</div>
          </div>

          {/* Found Members */}
          <div className="flex items-center justify-between p-3 bg-neutral-900 rounded hover:border-orange-600/50 border border-neutral-700 transition-colors">
            <div>
              <p className="text-xs text-neutral-400 tracking-wider mb-1">ENCONTRADOS</p>
              <p className="text-xl font-bold text-orange-500 font-mono">{foundMembers}</p>
            </div>
            <div className="text-2xl">🔍</div>
          </div>

          {/* Percentage Bar */}
          <div className="p-3 bg-neutral-900 rounded border border-neutral-700">
            <p className="text-xs text-neutral-400 tracking-wider mb-2">TAXA DE FILTRO</p>
            <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
                style={{
                  width: totalMembers > 0 ? `${(foundMembers / totalMembers) * 100}%` : '0%',
                }}
              />
            </div>
            <p className="text-xs text-neutral-400 mt-2">
              {totalMembers > 0 ? ((foundMembers / totalMembers) * 100).toFixed(0) : 0}% da base
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
