'use client'

import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { CRMLeadCard } from '@/components/crm-lead-card'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'

interface CRMKanbanBoardProps {
  leads: CRMLead[]
  onCardClick: (lead: CRMLead) => void
  onMoveCard: (leadId: string, newStage: CRMStage) => void
  onNewLead: (stage: CRMStage) => void
}

export function CRMKanbanBoard({ leads, onCardClick, onMoveCard, onNewLead }: CRMKanbanBoardProps) {
  const [dragOverStage, setDragOverStage] = useState<CRMStage | null>(null)
  const draggedLead = useRef<CRMLead | null>(null)

  const handleDragStart = (e: React.DragEvent, lead: CRMLead) => {
    draggedLead.current = lead
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
    // Add visual feedback
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

    onMoveCard(lead.id, stage)
  }

  return (
    <div className="relative h-full">
      <div className="flex gap-3 overflow-x-auto pb-4 h-full px-1">
        {CRM_STAGES.map((stageConfig) => {
          const stageLeads = leads
            .filter((l) => l.stage === stageConfig.id)
            .sort((a, b) => a.position - b.position)
          const isDragOver = dragOverStage === stageConfig.id

          return (
            <div
              key={stageConfig.id}
              className={`flex-shrink-0 w-72 md:w-80 flex flex-col bg-neutral-900/50 border rounded-xl transition-colors ${
                isDragOver
                  ? 'border-orange-500/50 bg-orange-500/5'
                  : 'border-neutral-800'
              }`}
              onDragOver={(e) => handleDragOver(e, stageConfig.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stageConfig.id)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between px-3 py-3 sm:p-3 border-b border-neutral-800">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${stageConfig.color}`} />
                  <h3 className="text-sm font-bold text-white tracking-wide truncate">{stageConfig.label}</h3>
                  <span className="bg-neutral-800 text-neutral-400 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 min-w-[24px] text-center">
                    {stageLeads.length}
                  </span>
                </div>
                <button
                  onClick={() => onNewLead(stageConfig.id)}
                  className="p-2.5 -m-1 text-neutral-500 hover:text-orange-500 hover:bg-neutral-800 active:bg-neutral-700 transition-colors rounded-lg flex-shrink-0 min-w-[44px] h-[44px] flex items-center justify-center"
                  title="Novo lead"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-[160px]">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onDragEnd={handleDragEnd}
                  >
                    <CRMLeadCard
                      lead={lead}
                      onClick={onCardClick}
                      onDragStart={handleDragStart}
                      onMoveCard={onMoveCard}
                    />
                  </div>
                ))}

                {stageLeads.length === 0 && (
                  <div className={`flex items-center justify-center h-32 border-2 border-dashed rounded-lg transition-colors ${
                    isDragOver ? 'border-orange-500/40 bg-orange-500/5' : 'border-neutral-800 text-neutral-700'
                  }`}>
                    <p className="text-xs text-neutral-600">{isDragOver ? 'Solte o card aqui' : 'Nenhum lead nesta etapa'}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Scroll affordance gradient */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-neutral-950 to-transparent" />
    </div>
  )
}
