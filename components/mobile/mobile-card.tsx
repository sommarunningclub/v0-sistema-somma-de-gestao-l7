'use client'

import { useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'

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
  borderColor?: 'green' | 'yellow' | 'red' | 'orange' | 'blue' | 'none'
  expandable?: boolean
  expandedContent?: React.ReactNode
  defaultExpanded?: boolean
  isUpdating?: boolean
  avatar?: string
  avatarBg?: string
}

export function MobileCard({
  title,
  subtitle,
  badge,
  fields,
  actions,
  onPress,
  loading,
  borderColor,
  expandable,
  expandedContent,
  defaultExpanded,
  isUpdating,
  avatar,
  avatarBg,
}: MobileCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false)

  const badgeColors = {
    success: 'bg-green-900 text-green-200',
    warning: 'bg-yellow-900 text-yellow-200',
    error: 'bg-red-900 text-red-200',
    info: 'bg-blue-900 text-blue-200',
  }

  const borderColorMap = {
    green:  'border-l-green-500',
    yellow: 'border-l-yellow-500',
    red:    'border-l-red-500',
    orange: 'border-l-orange-500',
    blue:   'border-l-blue-500',
    none:   'border-l-transparent',
  }

  const activeBorderColor = borderColorMap[borderColor ?? 'none']

  return (
    <div
      onClick={expandable ? () => setIsExpanded(e => !e) : onPress}
      className={`relative bg-neutral-800 border border-neutral-700 rounded-lg p-4 mb-3 transition-all border-l-[3px] ${activeBorderColor} ${
        expandable || onPress ? 'active:bg-neutral-700 cursor-pointer' : ''
      } ${loading ? 'opacity-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        {avatar && (
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mr-3 ${
              avatarBg ?? 'bg-neutral-700 text-neutral-300'
            }`}
          >
            {avatar}
          </div>
        )}
        <div className="flex items-center flex-1 min-w-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium text-sm truncate">{title}</h3>
            {subtitle && (
              <p className="text-neutral-400 text-xs mt-1 truncate">{subtitle}</p>
            )}
          </div>
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

      {/* Expandable content */}
      {expandable && expandedContent && (
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isExpanded ? 'max-h-96' : 'max-h-0'
          }`}
        >
          <div className="border-t border-neutral-700 pt-3">
            {expandedContent}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-neutral-900/60 rounded-lg flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
        </div>
      )}
    </div>
  )
}
