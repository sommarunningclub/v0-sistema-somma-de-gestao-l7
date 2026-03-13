'use client'

import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export interface SwipeAction {
  key: string
  label: string
  icon: React.ReactNode
  color: 'green' | 'blue' | 'orange' | 'red'
  onTrigger: () => void | Promise<void>
}

interface SwipeCardProps {
  children: React.ReactNode
  actions: SwipeAction[]
  disabled?: boolean
  revealThreshold?: number
  autoTriggerThreshold?: number
  className?: string
}

const actionBg: Record<SwipeAction['color'], string> = {
  green:  'bg-green-500/20 text-green-400',
  blue:   'bg-blue-500/20 text-blue-400',
  orange: 'bg-orange-500/20 text-orange-400',
  red:    'bg-red-500/20 text-red-400',
}

export function SwipeCard({
  children,
  actions,
  disabled,
  revealThreshold = 60,
  autoTriggerThreshold = 120,
  className,
}: SwipeCardProps) {
  const startXRef = useRef(0)
  const startYRef = useRef(0)
  const cancelledRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [triggering, setTriggering] = useState<string | null>(null)

  const ACTION_WIDTH = 64
  const totalActionsWidth = actions.length * ACTION_WIDTH

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return
    startXRef.current = e.touches[0].clientX
    startYRef.current = e.touches[0].clientY
    cancelledRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || cancelledRef.current) return
    const dx = startXRef.current - e.touches[0].clientX
    const dy = startYRef.current - e.touches[0].clientY

    // First 10px: cancel swipe if vertical scroll wins
    if (Math.abs(offset) < 5 && Math.abs(dy) > Math.abs(dx)) {
      cancelledRef.current = true
      setOffset(0)
      return
    }

    // Only allow left swipe (positive dx)
    if (dx < 0) { setOffset(0); return }
    setOffset(Math.min(dx, totalActionsWidth + 20))
  }

  const handleTouchEnd = async () => {
    if (disabled || cancelledRef.current) { setOffset(0); return }

    if (offset >= autoTriggerThreshold && actions[0]) {
      setOffset(totalActionsWidth)
      setTriggering(actions[0].key)
      await actions[0].onTrigger()
      setTriggering(null)
      setOffset(0)
    } else if (offset >= revealThreshold) {
      setOffset(totalActionsWidth)
    } else {
      setOffset(0)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className ?? ''}`}>
      {/* Actions revealed on swipe */}
      <div
        className="absolute right-0 top-0 bottom-0 flex"
        style={{ width: totalActionsWidth }}
      >
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={async () => {
              setTriggering(action.key)
              await action.onTrigger()
              setTriggering(null)
              setOffset(0)
            }}
            style={{ width: ACTION_WIDTH }}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold
              ${actionBg[action.color]}`}
          >
            {triggering === action.key
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Card content — slides left */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: offset === 0 ? 'transform 0.2s ease' : 'none',
        }}
        className="relative z-10 bg-neutral-900"
      >
        {children}
      </div>
    </div>
  )
}
