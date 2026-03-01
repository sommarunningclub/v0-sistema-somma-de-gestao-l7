'use client'

import { ChevronRight, MoreVertical } from 'lucide-react'

interface MobileCardProps {
  title: string
  subtitle?: string
  badge?: { label: string; color: 'success' | 'warning' | 'error' | 'info' }
  fields?: { label: string; value: string }[]
  actions?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
    variant?: 'default' | 'danger'
  }[]
  onPress?: () => void
  loading?: boolean
}

export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  onPress,
  loading,
}: MobileCardProps) {
  const badgeColors = {
    success: 'bg-green-900 text-green-200',
    warning: 'bg-yellow-900 text-yellow-200',
    error: 'bg-red-900 text-red-200',
    info: 'bg-blue-900 text-blue-200',
  }

  return (
    <div
      onClick={onPress}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg p-4 mb-3 transition-all ${
        onPress ? 'active:bg-neutral-700 cursor-pointer' : ''
      } ${loading ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm truncate">{title}</h3>
          {subtitle && (
            <p className="text-neutral-400 text-xs mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {badge && (
          <span
            className={`ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
              badgeColors[badge.color]
            }`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Fields */}
      {fields && fields.length > 0 && (
        <div className="space-y-2 mb-3 border-t border-neutral-700 pt-3">
          {fields.map((field, idx) => (
            <div key={idx} className="flex justify-between items-center">
              <span className="text-neutral-500 text-xs">{field.label}</span>
              <span className="text-white text-sm font-mono">{field.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 pt-3 border-t border-neutral-700">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
              className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-colors ${
                action.variant === 'danger'
                  ? 'bg-red-900 text-red-200 active:bg-red-800'
                  : 'bg-orange-600 text-white active:bg-orange-700'
              }`}
            >
              {action.icon ? (
                <span className="flex items-center justify-center gap-1">
                  {action.icon}
                  {action.label}
                </span>
              ) : (
                action.label
              )}
            </button>
          ))}
        </div>
      )}

      {/* Chevron */}
      {onPress && (
        <ChevronRight className="w-4 h-4 text-neutral-600 absolute right-4 top-1/2 -translate-y-1/2" />
      )}
    </div>
  )
}
