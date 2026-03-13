'use client'

import { Plus, Loader2 } from 'lucide-react'

interface FABProps {
  onClick: () => void
  icon?: React.ReactNode
  label?: string
  loading?: boolean
  className?: string
}

export function FAB({ onClick, icon, label, loading, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-label={label ?? 'Adicionar'}
      className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 h-14 rounded-full
        bg-orange-500 text-white shadow-lg shadow-orange-500/40
        active:scale-95 transition-transform
        disabled:opacity-60 disabled:cursor-not-allowed
        ${label ? 'px-5' : 'w-14 justify-center'}
        ${className ?? ''}`}
    >
      {loading
        ? <Loader2 className="w-5 h-5 animate-spin" />
        : (icon ?? <Plus className="w-6 h-6" />)}
      {label && !loading && <span className="text-sm font-semibold">{label}</span>}
    </button>
  )
}
