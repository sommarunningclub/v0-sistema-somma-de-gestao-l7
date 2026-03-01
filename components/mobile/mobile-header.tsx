'use client'

import { Menu, X } from 'lucide-react'
import { useState } from 'react'

interface MobileHeaderProps {
  title?: string
  onMenuClick?: () => void
  rightAction?: React.ReactNode
}

export function MobileHeader({
  title = 'Somma',
  onMenuClick,
  rightAction,
}: MobileHeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-neutral-900 border-b border-neutral-800 md:hidden">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Menu Button */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 hover:bg-neutral-800 rounded-lg transition-colors"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 text-neutral-300" />
        </button>

        {/* Title */}
        <h1 className="text-white font-semibold text-sm tracking-tight truncate flex-1 ml-2">
          {title}
        </h1>

        {/* Right Action */}
        <div className="flex items-center gap-1">
          {rightAction}
        </div>
      </div>
    </header>
  )
}
