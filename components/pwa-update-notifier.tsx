'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, X } from 'lucide-react'

export function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reg: ServiceWorkerRegistration

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setUpdateAvailable(true)
        setRegistration(reg)
      }
    }

    navigator.serviceWorker.ready
      .then((r) => {
        reg = r
        reg.addEventListener('controllerchange', () => {
          window.location.reload()
        })
      })
      .catch((err) => console.error('[PWA] SW ready failed:', err))

    const handleNewSW = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleUpdate(reg)
            }
          })
        }
      })
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })

    if (reg) {
      handleNewSW(reg)
      const checkInterval = setInterval(() => {
        reg.update().then(() => handleNewSW(reg))
      }, 60000) // Check every minute
      return () => clearInterval(checkInterval)
    }
  }, [])

  const handleUpdate = () => {
    if (!registration?.waiting) return

    // Tell the waiting service worker to take control
    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm bg-orange-500 text-black rounded-lg p-4 flex items-center gap-3 shadow-lg z-50 animate-in slide-in-from-bottom">
      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
      <div className="flex-1 text-sm font-medium">
        Nova versão disponível
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-auto px-2 py-1 text-xs bg-black text-white hover:bg-neutral-800"
          onClick={handleUpdate}
        >
          Atualizar
        </Button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-orange-600 rounded transition-colors"
          aria-label="Descartar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
