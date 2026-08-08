'use client'

import * as React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ResponsiveModal } from '@/components/somma/responsive-modal'

/**
 * Confirmação de ação destrutiva.
 *
 * Substitui as chamadas a `window.confirm()` espalhadas pelo painel — que não
 * são estilizáveis, não explicam a consequência, bloqueiam a thread e são
 * suprimidas por alguns navegadores. A API continua imperativa
 * (`await confirmAction({...})`), então a migração no call site é de uma linha.
 *
 * Funciona via um host único montado no shell; qualquer módulo pode chamar sem
 * precisar de provider próprio.
 */

export interface ConfirmOptions {
  title: string
  /** Diga o que acontece e se é reversível. */
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` para exclusões e ações irreversíveis. */
  tone?: 'danger' | 'default'
  /** Detalhe adicional (ex.: nome do registro afetado). */
  detail?: React.ReactNode
}

type PendingRequest = ConfirmOptions & { resolve: (value: boolean) => void }

const listeners = new Set<(request: PendingRequest) => void>()

/** Abre a confirmação e resolve com `true` se o usuário confirmar. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  if (listeners.size === 0) {
    // Sem host montado (ex.: rota isolada) — degrada para o diálogo nativo em
    // vez de silenciosamente aprovar uma ação destrutiva.
    if (typeof window !== 'undefined') {
      return Promise.resolve(window.confirm(options.title))
    }
    return Promise.resolve(false)
  }
  return new Promise<boolean>((resolve) => {
    listeners.forEach((listener) => listener({ ...options, resolve }))
  })
}

export function ConfirmHost() {
  const [request, setRequest] = React.useState<PendingRequest | null>(null)
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    const listener = (next: PendingRequest) => {
      setBusy(false)
      setRequest(next)
    }
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const settle = React.useCallback(
    (value: boolean) => {
      setRequest((current) => {
        current?.resolve(value)
        return null
      })
    },
    [],
  )

  if (!request) return null

  const isDanger = request.tone === 'danger'
  const Icon = isDanger ? Trash2 : AlertTriangle

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
      size="sm"
      title={request.title}
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)} className="sm:w-auto" block>
            {request.cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            variant={isDanger ? 'destructive' : 'default'}
            loading={busy}
            onClick={() => {
              setBusy(true)
              settle(true)
            }}
            className="sm:w-auto"
            block
          >
            {request.confirmLabel ?? (isDanger ? 'Excluir' : 'Confirmar')}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isDanger
              ? 'border-danger-border bg-danger-soft text-danger'
              : 'border-warning-border bg-warning-soft text-warning'
          }`}
        >
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {request.description ? (
            <p className="text-sm leading-relaxed text-ink-muted">{request.description}</p>
          ) : null}
          {request.detail ? (
            <div className="ds-well px-3 py-2.5 text-meta text-ink">{request.detail}</div>
          ) : null}
        </div>
      </div>
    </ResponsiveModal>
  )
}
