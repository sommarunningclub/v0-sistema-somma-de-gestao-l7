'use client'

import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      console.log('[PWA] Connection restored')
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log('[PWA] Connection lost')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-14 left-0 right-0 bg-red-600 text-white px-4 py-2 flex items-center justify-center text-sm font-medium z-40 lg:top-16">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
        Você está offline - Some funcionalidades podem estar limitadas
      </div>
    </div>
  )
}
