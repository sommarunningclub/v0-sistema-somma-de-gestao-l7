'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProtectedRoute from '@/components/protected-route'
import { ConfirmHost, UserMenu } from '@/components/somma'
import { OfflineBanner } from '@/hooks/use-online-status'

interface AuthenticatedChromeProps {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
  title?: string
}

/**
 * Moldura das rotas autenticadas que vivem fora da SPA do painel: cabeçalho
 * enxuto com volta, título e menu do usuário. Monta o `ConfirmHost` para que
 * `confirmAction` funcione aqui do mesmo jeito que dentro do `AdminShell`.
 */
export function AuthenticatedChrome({
  children,
  backHref = '/',
  backLabel = 'Voltar ao sistema',
  title,
}: AuthenticatedChromeProps) {
  return (
    <ProtectedRoute>
      <OfflineBanner />
      <ConfirmHost />
      <div className="flex h-[100dvh] w-full flex-col bg-canvas">
        <header className="pt-safe flex-shrink-0 border-b border-line bg-surface">
          <div className="flex h-14 items-center justify-between gap-3 px-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-1 sm:gap-2">
              <Link
                href={backHref}
                className="ds-tap flex items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{backLabel}</span>
                <span className="sr-only sm:hidden">{backLabel}</span>
              </Link>
              {title && (
                <>
                  <span className="text-ink-disabled" aria-hidden="true">
                    /
                  </span>
                  <h1 className="truncate text-[0.8125rem] font-semibold text-ink-strong">
                    {title}
                  </h1>
                </>
              )}
            </div>
            <UserMenu variant="compact" />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
