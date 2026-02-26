'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void
  threshold?: number
  onPullChange?: (distance: number) => void
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  onPullChange
}: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startYRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current
    if (!container) return

    // Only start tracking if we're at the top of the scroll container
    if (container.scrollTop === 0) {
      startYRef.current = e.touches[0].clientY
      setPullDistance(0)
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (startYRef.current === 0) return
    if (isRefreshing) return

    const container = containerRef.current
    if (!container || container.scrollTop !== 0) {
      startYRef.current = 0
      setPullDistance(0)
      return
    }

    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startYRef.current)

    // Dampen the pull distance for better UX (sqrt function makes it feel natural)
    const dampenedDistance = Math.sqrt(distance) * 5

    setPullDistance(dampenedDistance)
    onPullChange?.(dampenedDistance)
  }, [isRefreshing, onPullChange])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance < threshold || isRefreshing) {
      setPullDistance(0)
      startYRef.current = 0
      return
    }

    // Trigger refresh
    setIsRefreshing(true)
    setPullDistance(threshold)

    try {
      await onRefresh()
    } catch (error) {
      console.error('[v0] Pull-to-refresh error:', error)
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
      startYRef.current = 0
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('touchstart', handleTouchStart, false)
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, false)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    containerRef,
    isRefreshing,
    pullDistance,
    threshold
  }
}
