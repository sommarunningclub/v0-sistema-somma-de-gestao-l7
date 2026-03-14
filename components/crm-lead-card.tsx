'use client'

import { useState } from 'react'
import { Mail, Phone, GripVertical, ChevronRight, Video, MapPin, Calendar, Check, AlertCircle } from 'lucide-react'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'

interface CRMLeadCardProps {
  lead: CRMLead
  onClick: (lead: CRMLead) => void
  onDragStart: (e: React.DragEvent, lead: CRMLead) => void
  onMoveCard: (leadId: string, newStage: CRMStage) => void
}

export function CRMLeadCard({ lead, onClick, onDragStart, onMoveCard }: CRMLeadCardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const handleMoveStage = (newStage: CRMStage) => {
    if (newStage !== lead.stage) {
      onMoveCard(lead.id, newStage)
    }
    setShowMoveMenu(false)
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => onClick(lead)}
      className="group relative bg-neutral-800 border border-neutral-700 rounded-lg p-3 sm:p-3.5 cursor-pointer hover:border-orange-500/50 hover:bg-neutral-750 active:border-orange-500 active:bg-neutral-750 active:shadow-lg transition-all active:scale-[0.99] sm:active:scale-100 select-none touch-manipulation"
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="hidden sm:flex mt-1 text-neutral-600 group-hover:text-neutral-400 cursor-grab active:cursor-grabbing flex-shrink-0">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate leading-tight">{lead.name}</h4>

          {lead.email && (
            <div className="flex items-center gap-1.5 mt-2">
              <Mail className="w-3 h-3 text-neutral-500 flex-shrink-0" />
              <span className="text-xs text-neutral-400 truncate">{lead.email}</span>
            </div>
          )}

          {lead.phone && (
            <div className="flex items-center gap-1.5 mt-1">
              <Phone className="w-3 h-3 text-neutral-500 flex-shrink-0" />
              <span className="text-xs text-neutral-400 truncate">{lead.phone}</span>
            </div>
          )}

          {(lead.company_name || lead.description) && (
            <p className="text-xs text-neutral-500 mt-2.5 line-clamp-2">
              {lead.company_name || lead.description}
            </p>
          )}

          {/* Meeting summary — shown only in agendamento stage */}
          {lead.stage === 'agendamento' && lead.meeting && (
            <div className="mt-2.5 pt-2.5 border-t border-neutral-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Status badge */}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  lead.meeting.status === 'agendado' ? 'bg-cyan-500/20 text-cyan-400' :
                  lead.meeting.status === 'reagendado' ? 'bg-yellow-500/20 text-yellow-400' :
                  lead.meeting.status === 'cancelado' ? 'bg-red-500/20 text-red-400' :
                  lead.meeting.status === 'realizado' ? 'bg-green-500/20 text-green-400' :
                  'bg-neutral-700 text-neutral-400'
                }`}>
                  {lead.meeting.status.charAt(0).toUpperCase() + lead.meeting.status.slice(1)}
                </span>
                {/* Type badge */}
                <span className="flex items-center gap-1 text-[10px] text-neutral-500">
                  {lead.meeting.type === 'online'
                    ? <><Video className="w-3 h-3" /> Online</>
                    : <><MapPin className="w-3 h-3" /> Presencial</>
                  }
                </span>
                {/* Sync indicator */}
                {lead.meeting.google_sync_status === 'synced' && (
                  <Check className="w-3 h-3 text-green-500" title="Sincronizado com Google Calendar" />
                )}
                {lead.meeting.google_sync_status === 'failed' && (
                  <AlertCircle className="w-3 h-3 text-red-400" title="Falha na sincronização" />
                )}
              </div>
              {/* Date/time */}
              {lead.meeting.start_at && (
                <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>
                    {new Date(lead.meeting.start_at).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mobile move button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMoveMenu(!showMoveMenu)
            }}
            className="sm:hidden mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 py-2 px-2 rounded-lg transition-colors active:bg-orange-500/20"
          >
            <ChevronRight className="w-3.5 h-3.5" />
            Mover
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile stage picker menu */}
          {showMoveMenu && (
            <div className="sm:hidden absolute top-full left-3 right-3 mt-2 bg-neutral-800 border border-neutral-700 rounded-lg p-2 z-20 grid grid-cols-2 gap-1.5 shadow-xl">
              {CRM_STAGES.map((s) => (
                <button
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleMoveStage(s.id)
                  }}
                  className={`text-xs py-2.5 px-2 rounded-md border font-medium transition-all ${
                    lead.stage === s.id
                      ? `${s.color} text-white border-transparent shadow-md`
                      : 'bg-neutral-700 text-neutral-300 border-neutral-600 hover:border-neutral-500 active:bg-neutral-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
