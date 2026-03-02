'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface MobileBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  height?: 'full' | 'half' | 'auto'
  showHandle?: boolean
}

export function MobileBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  height = 'half',
  showHandle = true,
}: MobileBottomSheetProps) {
  if (!isOpen) return null

  const heightClass = {
    full: 'h-[90vh]',
    half: 'h-[50vh]',
    auto: 'h-auto max-h-[80vh]',
  }[height]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 rounded-t-2xl z-50 md:hidden ${heightClass} flex flex-col overflow-hidden`}
      >
        {/* Handle and Title Bar */}
        <div className="flex flex-col items-center pt-3 pb-3 border-b border-neutral-800">
          {showHandle && (
            <div className="w-10 h-1 bg-neutral-700 rounded-full mb-2" />
          )}
          {title && (
            <div className="flex items-center justify-between w-full px-4">
              <h2 className="text-white font-medium text-sm tracking-wide">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  )
}
