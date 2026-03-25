// components/popups-card.tsx
'use client'

import { BarChart2, Edit2, Megaphone, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { PopupWithStats } from '@/lib/services/popups'

interface PopupsCardProps {
  popup: PopupWithStats
  onEdit: (popup: PopupWithStats) => void
  onDelete: (id: string) => void
  onToggle: (id: string, value: boolean) => void
}

export default function PopupsCard({ popup, onEdit, onDelete, onToggle }: PopupsCardProps) {
  const router = useRouter()

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col group">
      {/* Image preview */}
      <div className="relative aspect-video bg-neutral-800 flex-shrink-0">
        {popup.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={popup.image_url}
            alt={popup.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Megaphone className="w-8 h-8 text-neutral-600" />
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium border ${
            popup.is_active
              ? 'bg-green-500/20 text-green-400 border-green-500/30'
              : 'bg-neutral-700/80 text-neutral-400 border-neutral-600'
          }`}
        >
          {popup.is_active ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold text-white text-sm leading-snug line-clamp-2">
          {popup.title}
        </h3>

        {/* Period */}
        <p className="text-xs text-neutral-500">
          {fmt(popup.start_date)} → {popup.end_date ? fmt(popup.end_date) : '∞'}
        </p>

        {/* Pages */}
        {popup.pages.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {popup.pages.slice(0, 3).map((p) => (
              <span
                key={p}
                className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded border border-neutral-700 truncate max-w-[80px]"
                title={p}
              >
                {p}
              </span>
            ))}
            {popup.pages.length > 3 && (
              <span className="text-xs text-neutral-600">
                +{popup.pages.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Click count */}
        <p className="text-xs text-neutral-500 flex items-center gap-1 mt-auto">
          <BarChart2 className="w-3.5 h-3.5" />
          {popup.clicks_7d} cliques (7d)
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800 mt-1">
          {/* Toggle */}
          <button
            onClick={() => onToggle(popup.id, !popup.is_active)}
            title={popup.is_active ? 'Desativar' : 'Ativar'}
            className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
              popup.is_active ? 'bg-orange-500' : 'bg-neutral-700'
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                popup.is_active ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>

          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={() => onEdit(popup)}
              title="Editar"
              className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => router.push(`/popups/${popup.id}/analytics`)}
              title="Ver analytics"
              className="p-1.5 text-neutral-500 hover:text-blue-400 transition-colors rounded"
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(popup.id)}
              title="Excluir"
              className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
