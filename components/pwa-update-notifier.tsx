'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'

export function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let checkInterval: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    const announce = (reg: ServiceWorkerRegistration) => {
      if (cancelled || !reg.waiting) return
      setUpdateAvailable(true)
      setRegistration(reg)
    }

    const watchForNewWorker = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            announce(reg)
          }
        })
      })
    }

    const reload = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', reload)

    navigator.serviceWorker.ready
      .then((reg) => {
        if (cancelled) return
        // Uma versão já pode estar esperando desde antes de montarmos.
        announce(reg)
        watchForNewWorker(reg)
        checkInterval = setInterval(() => {
          reg.update().catch((err) => console.error('[PWA] SW update failed:', err))
        }, 60000)
      })
      .catch((err) => console.error('[PWA] SW ready failed:', err))

    return () => {
      cancelled = true
      if (checkInterval) clearInterval(checkInterval)
      navigator.serviceWorker.removeEventListener('controllerchange', reload)
    }
  }, [])

  const handleUpdate = () => {
    if (!registration?.waiting) return

    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
  }

  if (!updateAvailable) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mb-safe flex items-center gap-3 rounded-xl border border-brand-border bg-surface-raised p-3 shadow-overlay animate-rise-in sm:left-auto sm:right-4 sm:max-w-sm"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] font-semibold text-ink-strong">Nova versão disponível</p>
        <p className="text-meta text-ink-muted">Recarregue para aplicar a atualização.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={handleUpdate}>
          Atualizar
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          className="ds-tap flex items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong"
          aria-label="Descartar"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
