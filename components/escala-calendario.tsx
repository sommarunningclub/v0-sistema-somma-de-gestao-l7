'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildMonthGrid } from '@/lib/escala-rules'
import { CORES_ESTADO, DIAS_SEMANA, nomeDoMes } from '@/lib/escala-ui'
import type { EscalaDiaResumo } from '@/lib/types/escala'

interface EscalaCalendarioProps {
  ano: number
  /** 1-based: 8 = agosto */
  mes: number
  dias: EscalaDiaResumo[]
  onMudarMes: (ano: number, mes: number) => void
  onSelecionarDia: (dia: EscalaDiaResumo) => void
}

export function EscalaCalendario({
  ano,
  mes,
  dias,
  onMudarMes,
  onSelecionarDia,
}: EscalaCalendarioProps) {
  const grid = buildMonthGrid(ano, mes)
  const porData = new Map(dias.map((d) => [d.data_evento, d]))

  const irPara = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1)
    onMudarMes(d.getFullYear(), d.getMonth() + 1)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => irPara(-1)}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-white font-bold text-lg capitalize">{nomeDoMes(ano, mes)}</h2>
        <button
          onClick={() => irPara(1)}
          className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Próximo mês"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 md:gap-2">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-[10px] md:text-xs text-neutral-500 font-bold text-center py-1">
            {d}
          </div>
        ))}

        {grid.map((celula) => {
          const dia = porData.get(celula.data)

          if (!dia) {
            return (
              <div
                key={celula.data}
                className={`min-h-[64px] md:min-h-[92px] rounded-lg border border-neutral-800 p-1.5 ${
                  celula.no_mes ? 'bg-neutral-900' : 'bg-neutral-950'
                }`}
              >
                <span className={`text-xs ${celula.no_mes ? 'text-neutral-500' : 'text-neutral-700'}`}>
                  {celula.dia}
                </span>
              </div>
            )
          }

          const cores = CORES_ESTADO[dia.estado]
          const incompletos = dia.pelotoes_resumo.filter((p) => p.estado !== 'completo')

          return (
            <button
              key={celula.data}
              onClick={() => onSelecionarDia(dia)}
              className={`min-h-[64px] md:min-h-[92px] rounded-lg border p-1.5 text-left transition-all hover:brightness-125 active:scale-95 ${cores.fundo} ${cores.borda}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{celula.dia}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${cores.ponto}`} />
              </div>
              <p className="text-[10px] text-neutral-300 truncate mt-0.5">{dia.titulo}</p>
              <p className={`text-[11px] font-bold ${cores.texto}`}>
                {dia.corredores}/{dia.meta_total}
              </p>
              {dia.apoio > 0 && (
                <p className="text-[10px] text-neutral-400">+{dia.apoio} apoio</p>
              )}
              {incompletos.length > 0 && (
                <p className="text-[10px] text-neutral-400 truncate hidden md:block">
                  {incompletos.map((p) => `${p.pelotao} ${p.escalados}/${p.meta}`).join(' · ')}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
