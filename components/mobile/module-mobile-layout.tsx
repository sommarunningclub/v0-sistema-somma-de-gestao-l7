'use client'

import { ReactNode, useState } from 'react'
import { Search, X, ChevronDown, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MobileBottomSheet } from '@/components/mobile/mobile-bottom-sheet'

interface ModuleMobileLayoutProps {
  title: string
  badge?: string
  children: ReactNode
  onSearch?: (query: string) => void
  searchPlaceholder?: string
  onAddNew?: () => void
  filterActions?: {
    label: string
    onClick: () => void
    icon?: ReactNode
  }[]
  stats?: {
    label: string
    value: string
    color?: 'primary' | 'success' | 'warning' | 'error'
  }[]
}

export function ModuleMobileLayout({
  title,
  badge,
  children,
  onSearch,
  searchPlaceholder = 'Buscar...',
  onAddNew,
  filterActions,
  stats,
}: ModuleMobileLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    onSearch?.(value)
  }

  const statColors = {
    primary: 'bg-blue-900/30 text-blue-300 border-blue-800',
    success: 'bg-green-900/30 text-green-300 border-green-800',
    warning: 'bg-yellow-900/30 text-yellow-300 border-yellow-800',
    error: 'bg-red-900/30 text-red-300 border-red-800',
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900">
      {/* Header */}
      <div className="sticky top-14 md:top-0 z-20 bg-neutral-900 border-b border-neutral-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg md:text-2xl font-bold text-white">{title}</h1>
          {onAddNew && (
            <Button
              onClick={onAddNew}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo</span>
            </Button>
          )}
        </div>

        {/* Stats Row - Mobile Horizontal Scroll */}
        {stats && stats.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={`flex-shrink-0 px-3 py-2 rounded-lg border ${
                  statColors[stat.color || 'primary']
                }`}
              >
                <p className="text-xs opacity-75">{stat.label}</p>
                <p className="text-sm font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Search + Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-9 bg-neutral-800 border-neutral-700 text-white placeholder-neutral-500 h-10"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filterActions && filterActions.length > 0 && (
            <Button
              onClick={() => setFiltersOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-800"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* Filters Bottom Sheet */}
      {filterActions && filterActions.length > 0 && (
        <MobileBottomSheet
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filtros"
          height="auto"
        >
          <div className="space-y-2">
            {filterActions.map((action, idx) => (
              <Button
                key={idx}
                onClick={() => {
                  action.onClick()
                  setFiltersOpen(false)
                }}
                variant="outline"
                className="w-full justify-start gap-2 h-11 bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </MobileBottomSheet>
      )}
    </div>
  )
}
