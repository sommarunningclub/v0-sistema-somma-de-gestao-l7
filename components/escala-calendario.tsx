'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { buildMonthGrid } from '@/lib/escala-rules'
import { DIAS_SEMANA, nomeDoMes } from '@/lib/escala-ui'
import { Button } from '@/components/ui/button'
import { Panel, StatusPill, type StatusTone } from '@/components/somma'
import type { EscalaDiaResumo, EstadoPreenchimento } from '@/lib/types/escala'

interface EscalaCalendarioProps {
  ano: number
  /** 1-based: 8 = agosto */
  mes: number
  dias: EscalaDiaResumo[]
  onMudarMes: (ano: number, mes: number) => void
  onSelecionarDia: (dia: EscalaDiaResumo) => void
}

const TOM_ESTADO: Record<EstadoPreenchimento, StatusTone> = {
  completo: 'success',
  parcial: 'warning',
  vazio: 'danger',
}

const ROTULO_ESTADO: Record<EstadoPreenchimento, string> = {
  completo: 'Escala completa',
  parcial: 'Escala parcial',
  vazio: 'Sem ninguém escalado',
}

/** Borda/fundo da célula por estado — o texto sempre repete a informação. */
const CELULA_ESTADO: Record<EstadoPreenchimento, string> = {
  completo: 'border-success-border bg-success-soft',
  parcial: 'border-warning-border bg-warning-soft',
  vazio: 'border-danger-border bg-danger-soft',
}

const TEXTO_ESTADO: Record<EstadoPreenchimento, string> = {
  completo: 'text-success',
  parcial: 'text-warning',
  vazio: 'text-danger',
}

const DIAS_SEMANA_LONGO = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
]

function dataPorExtenso(data: string): string {
  return new Date(`${data}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function EscalaCalendario({
  ano,
  mes,
  dias,
  onMudarMes,
  onSelecionarDia,
}: EscalaCalendarioProps) {
  const grid = useMemo(() => buildMonthGrid(ano, mes), [ano, mes])
  const porData = useMemo(() => new Map(dias.map((d) => [d.data_evento, d])), [dias])

  const [focoIdx, setFocoIdx] = useState(0)
  const celulasRef = useRef<Array<HTMLButtonElement | null>>([])

  // Ao trocar de mês, o foco volta para o primeiro dia do mês corrente.
  useEffect(() => {
    const primeiro = grid.findIndex((c) => c.no_mes)
    setFocoIdx(primeiro === -1 ? 0 : primeiro)
  }, [grid])

  const irPara = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1)
    onMudarMes(d.getFullYear(), d.getMonth() + 1)
  }

  const mover = (destino: number) => {
    const idx = Math.max(0, Math.min(grid.length - 1, destino))
    setFocoIdx(idx)
    celulasRef.current[idx]?.focus()
  }

  const aoTeclar = (event: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    switch (event.key) {
      case 'ArrowRight': event.preventDefault(); mover(idx + 1); break
      case 'ArrowLeft': event.preventDefault(); mover(idx - 1); break
      case 'ArrowDown': event.preventDefault(); mover(idx + 7); break
      case 'ArrowUp': event.preventDefault(); mover(idx - 7); break
      case 'Home': event.preventDefault(); mover(idx - (idx % 7)); break
      case 'End': event.preventDefault(); mover(idx - (idx % 7) + 6); break
      default: break
    }
  }

  const diasComEscala = dias
    .slice()
    .sort((a, b) => a.data_evento.localeCompare(b.data_evento))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => irPara(-1)} aria-label="Mês anterior">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 aria-live="polite" className="text-base font-semibold tracking-tight text-ink-strong first-letter:uppercase sm:text-lg">
          {nomeDoMes(ano, mes)}
        </h2>
        <Button variant="ghost" size="icon" onClick={() => irPara(1)} aria-label="Próximo mês">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <Panel className="p-2 sm:p-3">
        <div role="grid" aria-label={`Calendário de ${nomeDoMes(ano, mes)}`} className="space-y-1">
          <div role="row" className="grid grid-cols-7 gap-1 md:gap-2">
            {DIAS_SEMANA.map((d, i) => (
              <div
                key={d}
                role="columnheader"
                aria-label={DIAS_SEMANA_LONGO[i]}
                className="py-1 text-center text-micro font-semibold uppercase tracking-[0.08em] text-ink-muted"
              >
                {d}
              </div>
            ))}
          </div>

          {Array.from({ length: 6 }).map((_, linha) => (
            <div key={linha} role="row" className="grid grid-cols-7 gap-1 md:gap-2">
              {grid.slice(linha * 7, linha * 7 + 7).map((celula, coluna) => {
                const idx = linha * 7 + coluna
                const dia = porData.get(celula.data)
                const extenso = dataPorExtenso(celula.data)

                return (
                  <div key={celula.data} role="gridcell" className="min-w-0">
                    <button
                      type="button"
                      ref={(el) => { celulasRef.current[idx] = el }}
                      tabIndex={idx === focoIdx ? 0 : -1}
                      onFocus={() => setFocoIdx(idx)}
                      onKeyDown={(event) => aoTeclar(event, idx)}
                      onClick={dia ? () => onSelecionarDia(dia) : undefined}
                      aria-disabled={dia ? undefined : true}
                      aria-label={
                        dia
                          ? `${extenso}. ${dia.titulo}. ${dia.corredores} de ${dia.meta_total} corredores escalados. ${ROTULO_ESTADO[dia.estado]}.`
                          : `${extenso}. Sem evento.`
                      }
                      className={[
                        'ds-tap flex min-h-[52px] w-full flex-col items-start rounded-lg border p-1.5 text-left transition-colors md:min-h-[92px]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
                        dia
                          ? `${CELULA_ESTADO[dia.estado]} cursor-pointer hover:brightness-125 active:scale-[0.97]`
                          : celula.no_mes
                            ? 'border-line-soft bg-surface-raised cursor-default'
                            : 'border-transparent bg-surface-sunken cursor-default',
                      ].join(' ')}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span
                          className={[
                            'text-xs font-semibold',
                            dia ? 'text-ink-strong' : celula.no_mes ? 'text-ink-muted' : 'text-ink-disabled',
                          ].join(' ')}
                        >
                          {celula.dia}
                        </span>
                        {dia ? (
                          <span
                            className={`font-mono text-micro font-bold tabular-nums ${TEXTO_ESTADO[dia.estado]}`}
                          >
                            {dia.corredores}/{dia.meta_total}
                          </span>
                        ) : null}
                      </div>

                      {dia ? (
                        <>
                          <p className="mt-0.5 hidden w-full truncate text-micro text-ink md:block">
                            {dia.titulo}
                          </p>
                          {dia.apoio > 0 ? (
                            <p className="hidden text-micro text-ink-muted md:block">+{dia.apoio} apoio</p>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </Panel>

      {/* Legenda — o estado nunca é comunicado só pela cor da célula. */}
      <div className="flex flex-wrap items-center gap-2">
        {(['completo', 'parcial', 'vazio'] as EstadoPreenchimento[]).map((estado) => (
          <StatusPill key={estado} tone={TOM_ESTADO[estado]}>
            {ROTULO_ESTADO[estado]}
          </StatusPill>
        ))}
      </div>

      {/* No celular a grade serve para orientação; a ação acontece nesta lista. */}
      {diasComEscala.length > 0 ? (
        <div className="md:hidden">
          <h3 className="mb-2 ds-eyebrow">Dias com evento neste mês</h3>
          <ul className="space-y-2">
            {diasComEscala.map((dia) => (
              <li key={dia.evento_id}>
                <button
                  type="button"
                  onClick={() => onSelecionarDia(dia)}
                  aria-label={`Abrir escala de ${dataPorExtenso(dia.data_evento)} — ${dia.titulo}`}
                  className="ds-tap flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-raised p-3 text-left transition-colors active:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink-strong">{dia.titulo}</span>
                    <span className="mt-0.5 block text-meta text-ink-muted first-letter:uppercase">
                      {new Date(`${dia.data_evento}T12:00:00`).toLocaleDateString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                      })}{' '}
                      · {dia.horario_inicio}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-mono text-meta font-bold tabular-nums text-ink">
                      <Users aria-hidden="true" className="h-3.5 w-3.5 text-ink-subtle" />
                      {dia.corredores}/{dia.meta_total}
                    </span>
                    <StatusPill tone={TOM_ESTADO[dia.estado]}>{ROTULO_ESTADO[dia.estado]}</StatusPill>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
