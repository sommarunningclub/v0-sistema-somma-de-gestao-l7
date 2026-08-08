'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { CRMLeadCard, STAGE_TONE, stageLabel } from '@/components/crm-lead-card'
import { EmptyState, StatusPill } from '@/components/somma'
import { Button } from '@/components/ui/button'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'

/**
 * Quadro do funil.
 *
 * O arrastar-e-soltar HTML5 continua exatamente como estava; o que mudou é que
 * ele deixou de ser o único caminho: cada cartão tem um seletor "Mover para…"
 * e toda mudança de fase é anunciada por uma região `aria-live`.
 */

interface CRMKanbanBoardProps {
  leads: CRMLead[]
  onCardClick: (lead: CRMLead) => void
  onMoveCard: (leadId: string, newStage: CRMStage) => void
  onNewLead: (stage: CRMStage) => void
}

/** Dica contextual quando a fase está vazia. */
const STAGE_EMPTY_HINT: Record<CRMStage, string> = {
  novo_lead: 'Cadastre um lead para começar o funil.',
  contato_inicial: 'Nenhum lead em primeiro contato.',
  agendamento: 'Nenhuma reunião a agendar nesta fase.',
  proposta_enviada: 'Nenhuma proposta aguardando resposta.',
  negociacao: 'Nada em negociação no momento.',
  fechado_ganho: 'Nenhuma parceria fechada ainda.',
  perdido: 'Nenhum lead perdido — bom sinal.',
}

export function CRMKanbanBoard({ leads, onCardClick, onMoveCard, onNewLead }: CRMKanbanBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<CRMStage | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [visibleStage, setVisibleStage] = useState<CRMStage>(CRM_STAGES[0].id)
  const draggedLead = useRef<CRMLead | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const announceMove = useCallback(
    (lead: CRMLead, stage: CRMStage) => {
      setAnnouncement(`${lead.name} movido para ${stageLabel(stage)}.`)
    },
    [],
  )

  const handleMove = useCallback(
    (leadId: string, stage: CRMStage) => {
      const lead = leads.find((l) => l.id === leadId)
      if (lead) announceMove(lead, stage)
      onMoveCard(leadId, stage)
    },
    [announceMove, leads, onMoveCard],
  )

  const handleDragStart = (e: React.DragEvent, lead: CRMLead) => {
    draggedLead.current = lead
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    draggedLead.current = null
    setDragOverStage(null)
  }

  const handleDragOver = (e: React.DragEvent, stage: CRMStage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stage)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, stage: CRMStage) => {
    e.preventDefault()
    setDragOverStage(null)

    const lead = draggedLead.current
    if (!lead || lead.stage === stage) return

    announceMove(lead, stage)
    onMoveCard(lead.id, stage)
  }

  // Qual coluna está visível no celular (scroll com snap).
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const onScroll = () => {
      const center = scroller.scrollLeft + scroller.clientWidth / 2
      const columns = Array.from(
        scroller.querySelectorAll<HTMLElement>('[data-stage]'),
      )
      let nearest: HTMLElement | null = null
      let best = Number.POSITIVE_INFINITY
      for (const column of columns) {
        const distance = Math.abs(column.offsetLeft + column.offsetWidth / 2 - center)
        if (distance < best) {
          best = distance
          nearest = column
        }
      }
      const stage = nearest?.dataset.stage as CRMStage | undefined
      if (stage) setVisibleStage(stage)
    }

    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [])

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum lead no funil"
        description="Cadastre o primeiro lead para acompanhar a parceria da prospecção ao fechamento."
        action={
          <Button onClick={() => onNewLead('novo_lead')}>
            <Plus aria-hidden="true" />
            Novo lead
          </Button>
        }
      />
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {/* Indicador de fase visível — só faz sentido no scroll do celular. */}
      <div className="mb-2 flex items-center gap-2 lg:hidden">
        <StatusPill tone={STAGE_TONE[visibleStage]}>{stageLabel(visibleStage)}</StatusPill>
        <span className="text-micro text-ink-subtle">
          {CRM_STAGES.findIndex((s) => s.id === visibleStage) + 1} de {CRM_STAGES.length} fases —
          deslize para o lado
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollerRef}
          className="scroll-touch no-scrollbar flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-0.5 pb-4"
        >
          {CRM_STAGES.map((stageConfig) => {
            const stageLeads = leads
              .filter((l) => l.stage === stageConfig.id)
              .sort((a, b) => a.position - b.position)
            const isDragOver = dragOverStage === stageConfig.id

            return (
              <section
                key={stageConfig.id}
                data-stage={stageConfig.id}
                aria-label={`${stageConfig.label} — ${stageLeads.length} lead(s)`}
                className={`flex w-[85vw] shrink-0 snap-center flex-col rounded-xl border bg-surface transition-colors sm:w-72 md:w-80 ${
                  isDragOver ? 'border-brand-border bg-brand-soft' : 'border-line'
                }`}
                onDragOver={(e) => handleDragOver(e, stageConfig.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stageConfig.id)}
              >
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <StatusPill tone={STAGE_TONE[stageConfig.id]}>{stageConfig.label}</StatusPill>
                    <span className="shrink-0 font-mono text-meta tabular-nums text-ink-muted">
                      {stageLeads.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onNewLead(stageConfig.id)}
                    aria-label={`Novo lead em ${stageConfig.label}`}
                  >
                    <Plus aria-hidden="true" />
                  </Button>
                </div>

                <div className="scroll-touch min-h-[160px] flex-1 space-y-2.5 overflow-y-auto p-2.5">
                  {stageLeads.map((lead) => (
                    <div key={lead.id} onDragEnd={handleDragEnd}>
                      <CRMLeadCard
                        lead={lead}
                        onClick={onCardClick}
                        onDragStart={handleDragStart}
                        onMoveCard={handleMove}
                      />
                    </div>
                  ))}

                  {stageLeads.length === 0 ? (
                    <div
                      className={`flex h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-3 text-center transition-colors ${
                        isDragOver ? 'border-brand-border bg-brand-soft' : 'border-line'
                      }`}
                    >
                      <p className="text-meta text-ink-muted">
                        {isDragOver ? 'Solte o card aqui' : STAGE_EMPTY_HINT[stageConfig.id]}
                      </p>
                      {!isDragOver ? (
                        <Button variant="ghost" size="sm" onClick={() => onNewLead(stageConfig.id)}>
                          <Plus aria-hidden="true" />
                          Adicionar
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>

        {/* Affordance de scroll — sutil e no tom do canvas. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas/70 to-transparent"
        />
      </div>
    </div>
  )
}
