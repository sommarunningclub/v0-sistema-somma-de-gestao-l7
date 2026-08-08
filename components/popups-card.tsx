// components/popups-card.tsx
'use client'

import { BarChart2, Edit2, Megaphone, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Panel, StatusPill, type StatusTone } from '@/components/somma'
import type { PopupWithStats } from '@/lib/services/popups'

interface PopupsCardProps {
  popup: PopupWithStats
  onEdit: (popup: PopupWithStats) => void
  onDelete: (popup: PopupWithStats) => void
  onToggle: (id: string, value: boolean) => void
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
})
const numberFormatter = new Intl.NumberFormat('pt-BR')

/** Situação de exibição do pop-up — combina o interruptor com a janela de datas. */
export function popupStatus(popup: {
  is_active: boolean
  start_date: string
  end_date: string | null
}): { label: string; tone: StatusTone } {
  if (!popup.is_active) return { label: 'Inativo', tone: 'neutral' }

  const now = Date.now()
  const start = new Date(popup.start_date).getTime()
  const end = popup.end_date ? new Date(popup.end_date).getTime() : null

  if (Number.isFinite(start) && start > now) return { label: 'Agendado', tone: 'warning' }
  if (end !== null && Number.isFinite(end) && end < now) return { label: 'Expirado', tone: 'danger' }
  return { label: 'Ativo', tone: 'success' }
}

export default function PopupsCard({ popup, onEdit, onDelete, onToggle }: PopupsCardProps) {
  const router = useRouter()

  const fmt = (value: string) => {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
  }

  const status = popupStatus(popup)
  const period = `${fmt(popup.start_date)} até ${popup.end_date ? fmt(popup.end_date) : 'sem fim definido'}`

  return (
    <Panel className="group flex flex-col overflow-hidden">
      <div className="relative aspect-video shrink-0 bg-surface-sunken">
        {popup.image_url ? (
           
          <img
            src={popup.image_url}
            alt={`Imagem do pop-up ${popup.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Megaphone aria-hidden="true" className="h-8 w-8 text-ink-subtle" />
          </div>
        )}
        <StatusPill tone={status.tone} className="absolute right-2 top-2 backdrop-blur-md">
          {status.label}
        </StatusPill>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-strong">
          {popup.title}
        </h3>

        <p className="text-meta text-ink-muted">
          <span className="ds-eyebrow mr-1.5">Período</span>
          {period}
        </p>

        {popup.pages.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Páginas onde o pop-up é exibido">
            {popup.pages.slice(0, 3).map((page) => (
              <li
                key={page}
                title={page}
                className="max-w-[7rem] truncate rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-micro text-ink-muted"
              >
                {page}
              </li>
            ))}
            {popup.pages.length > 3 && (
              <li className="px-1 py-0.5 text-micro text-ink-subtle">
                +{popup.pages.length - 3}
              </li>
            )}
          </ul>
        )}

        <dl className="ds-well mt-auto grid grid-cols-2 gap-2 px-3 py-2.5">
          <div>
            <dt className="ds-eyebrow">Impressões 7d</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-ink-strong">
              {numberFormatter.format(popup.views_7d)}
            </dd>
          </div>
          <div>
            <dt className="ds-eyebrow">Cliques 7d</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums text-ink-strong">
              {numberFormatter.format(popup.clicks_7d)}
            </dd>
          </div>
        </dl>

        <div className="mt-1 flex items-center gap-1 border-t border-line-soft pt-2">
          <button
            type="button"
            role="switch"
            aria-checked={popup.is_active}
            onClick={() => onToggle(popup.id, !popup.is_active)}
            className="ds-tap -ml-2 inline-flex items-center gap-2 rounded-lg px-2 text-meta text-ink-muted transition-colors hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <span
              aria-hidden="true"
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                popup.is_active ? 'bg-brand' : 'bg-surface-active border border-line-strong'
              }`}
            >
              <span
                className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                  popup.is_active ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </span>
            {popup.is_active ? 'Ativo' : 'Inativo'}
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onEdit(popup)}
              aria-label={`Editar ${popup.title}`}
              className="ds-tap inline-flex w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Edit2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => router.push(`/popups/${popup.id}/analytics`)}
              aria-label={`Ver analytics de ${popup.title}`}
              className="ds-tap inline-flex w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <BarChart2 aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(popup)}
              aria-label={`Excluir ${popup.title}`}
              className="ds-tap inline-flex w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </Panel>
  )
}
