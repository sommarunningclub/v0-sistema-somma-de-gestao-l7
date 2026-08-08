'use client'

import { useId } from 'react'
import {
  AlertCircle,
  Building2,
  CalendarClock,
  Check,
  GripVertical,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Video,
} from 'lucide-react'
import { StatusPill, type StatusTone } from '@/components/somma'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'

/**
 * Cartão de lead do funil.
 *
 * Além do arrastar-e-soltar (que continua igual), o cartão expõe um seletor
 * "Mover para…" — é a alternativa por teclado ao drag-and-drop HTML5, que não
 * tem nenhuma. Ambos os caminhos chamam a mesma `onMoveCard`.
 */

/** Tom visual de cada fase do funil. Fonte única para card, coluna e lista. */
export const STAGE_TONE: Record<CRMStage, StatusTone> = {
  novo_lead: 'neutral',
  contato_inicial: 'info',
  agendamento: 'info',
  proposta_enviada: 'brand',
  negociacao: 'warning',
  fechado_ganho: 'success',
  perdido: 'danger',
}

export const MEETING_STATUS_TONE: Record<string, StatusTone> = {
  pendente: 'neutral',
  agendado: 'info',
  reagendado: 'warning',
  cancelado: 'danger',
  realizado: 'success',
}

export function stageLabel(stage: CRMStage): string {
  return CRM_STAGES.find((s) => s.id === stage)?.label ?? stage
}

interface CRMLeadCardProps {
  lead: CRMLead
  onClick: (lead: CRMLead) => void
  onDragStart: (e: React.DragEvent, lead: CRMLead) => void
  onMoveCard: (leadId: string, newStage: CRMStage) => void
}

export function CRMLeadCard({ lead, onClick, onDragStart, onMoveCard }: CRMLeadCardProps) {
  const moveId = useId()

  const meeting = lead.stage === 'agendamento' ? lead.meeting : null
  const nextActionDate = meeting?.start_at ?? null

  const handleMove = (newStage: CRMStage) => {
    if (newStage !== lead.stage) onMoveCard(lead.id, newStage)
  }

  return (
    <article
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={(event) => {
        // Cliques em controles internos (mover, links) não abrem o lead.
        if ((event.target as HTMLElement).closest('[data-card-control]')) return
        onClick(lead)
      }}
      className="group relative select-none rounded-xl border border-line bg-surface-raised p-3.5 transition-colors hover:border-line-strong hover:bg-surface-hover"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 hidden shrink-0 cursor-grab text-ink-disabled transition-colors group-hover:text-ink-subtle active:cursor-grabbing sm:block"
        >
          <GripVertical className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="min-w-0 text-sm font-semibold leading-snug text-ink-strong">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onClick(lead)
                }}
                className="block max-w-full truncate rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="sr-only">Abrir lead </span>
                {lead.name}
              </button>
            </h4>
            <StatusPill tone={STAGE_TONE[lead.stage]} className="shrink-0">
              {stageLabel(lead.stage)}
            </StatusPill>
          </div>

          <dl className="mt-2.5 space-y-1.5">
            {lead.company_name ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Empresa</dt>
                <Building2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <dd className="truncate text-meta text-ink">{lead.company_name}</dd>
              </div>
            ) : null}

            {lead.email ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">E-mail</dt>
                <Mail aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <dd className="truncate text-meta text-ink-muted">{lead.email}</dd>
              </div>
            ) : null}

            {lead.phone ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Telefone</dt>
                <Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <dd className="truncate text-meta text-ink-muted">{lead.phone}</dd>
              </div>
            ) : null}

            {lead.created_by ? (
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Responsável</dt>
                <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                <dd className="truncate text-meta text-ink-muted">{lead.created_by}</dd>
              </div>
            ) : null}
          </dl>

          {meeting ? (
            <div className="mt-3 space-y-1.5 border-t border-line-soft pt-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusPill tone={MEETING_STATUS_TONE[meeting.status] ?? 'neutral'} dot={false}>
                  {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
                </StatusPill>
                <span className="inline-flex items-center gap-1 text-micro text-ink-muted">
                  {meeting.type === 'online' ? (
                    <>
                      <Video aria-hidden="true" className="h-3 w-3" /> Online
                    </>
                  ) : (
                    <>
                      <MapPin aria-hidden="true" className="h-3 w-3" /> Presencial
                    </>
                  )}
                </span>
                {meeting.google_sync_status === 'synced' ? (
                  <span
                    title="Sincronizado com Google Calendar"
                    aria-label="Sincronizado com Google Calendar"
                    role="img"
                    className="inline-flex text-success"
                  >
                    <Check aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                {meeting.google_sync_status === 'failed' ? (
                  <span
                    title="Falha na sincronização com Google Calendar"
                    aria-label="Falha na sincronização com Google Calendar"
                    role="img"
                    className="inline-flex text-danger"
                  >
                    <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>

              {nextActionDate ? (
                <p className="flex items-center gap-1.5 text-micro text-ink-muted">
                  <CalendarClock aria-hidden="true" className="h-3 w-3 shrink-0" />
                  <span>
                    Próxima ação:{' '}
                    <time dateTime={nextActionDate}>
                      {new Date(nextActionDate).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Alternativa por teclado ao arrastar-e-soltar. */}
          <div data-card-control className="mt-3 flex items-center gap-2 border-t border-line-soft pt-2.5">
            <label htmlFor={moveId} className="ds-label shrink-0">
              Mover para
            </label>
            <select
              id={moveId}
              value={lead.stage}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => handleMove(event.target.value as CRMStage)}
              className="ds-tap min-h-[44px] w-full min-w-0 flex-1 rounded-lg border border-line bg-surface-sunken px-2.5 text-[0.8125rem] text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:min-h-0 lg:h-9"
            >
              {CRM_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </article>
  )
}
