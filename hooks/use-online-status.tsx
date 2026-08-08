'use client'

import { useEffect, useState } from 'react'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
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

/**
 * Aviso de conexão perdida para as rotas que não usam o `AdminShell` — ele já
 * tem o seu próprio. Fica ancorado no rodapé, respeitando a safe area, para
 * não competir com o cabeçalho nem esconder ações do topo.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center gap-2 rounded-full border border-warning-border bg-warning-soft px-4 py-2 text-meta font-medium text-warning shadow-raised backdrop-blur-sm">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-warning animate-brand-pulse"
          aria-hidden="true"
        />
        Você está offline — algumas funcionalidades podem estar limitadas
      </div>
    </div>
  )
}
