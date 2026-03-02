'use client'

import { Home, LayoutDashboard, Settings, LogOut, ChevronRight } from 'lucide-react'
import { useState } from 'react'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  badge?: number
}

interface MobileNavigationProps {
  items: NavItem[]
  activeId?: string
  onLogout?: () => void
}

export function MobileNavigation({
  items,
  activeId,
  onLogout,
}: MobileNavigationProps) {
  return (
    <nav className="flex flex-col h-full bg-neutral-900">
      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors border-l-2 ${
              activeId === item.id
                ? 'border-orange-500 bg-neutral-800 text-white'
                : 'border-transparent text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            <div className="w-5 h-5">{item.icon}</div>
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && (
              <span className="bg-orange-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-neutral-600" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      {onLogout && (
        <div className="border-t border-neutral-800 p-4">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </nav>
  )
}
