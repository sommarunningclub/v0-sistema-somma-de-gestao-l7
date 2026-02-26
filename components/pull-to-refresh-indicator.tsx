'use client'

import { RefreshCw } from 'lucide-react'

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold
}: PullToRefreshIndicatorProps) {
  // Only show indicator when pulling or refreshing
  if (pullDistance < 10 && !isRefreshing) return null

  const progress = Math.min(pullDistance / threshold, 1)
  const isReady = pullDistance >= threshold

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all duration-200 pointer-events-none"
      style={{
        height: Math.min(pullDistance, 80),
        backgroundColor: isReady ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-2">
        <div
          className={`transition-transform duration-300 ${
            isRefreshing ? 'animate-spin' : ''
          }`}
          style={{
            transform: `rotate(${progress * 180}deg) scaleY(${Math.max(0.5, progress)})`,
            opacity: Math.max(0.3, progress),
          }}
        >
          <RefreshCw className={`w-5 h-5 ${
            isReady ? 'text-orange-500' : 'text-neutral-500'
          }`} />
        </div>
        {!isRefreshing && pullDistance > 20 && (
          <div className="text-xs text-neutral-400 font-medium animate-pulse">
            {isReady ? 'Solte para atualizar' : 'Puxe para atualizar'}
          </div>
        )}
        {isRefreshing && (
          <div className="text-xs text-neutral-400 font-medium">Atualizando...</div>
        )}
      </div>
    </div>
  )
}
