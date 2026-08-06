'use client'

import Link from 'next/link'
import { ArrowLeft, LogOut } from 'lucide-react'
import ProtectedRoute from '@/components/protected-route'
import { logout } from '@/components/protected-route'
import { OfflineBanner } from '@/hooks/use-online-status'

interface AuthenticatedChromeProps {
  children: React.ReactNode
  backHref?: string
  backLabel?: string
  title?: string
}

export function AuthenticatedChrome({
  children,
  backHref = '/',
  backLabel = 'Voltar ao sistema',
  title,
}: AuthenticatedChromeProps) {
  return (
    <ProtectedRoute>
      <OfflineBanner />
      <div className="flex flex-col h-screen w-screen bg-black">
        <header className="h-14 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </Link>
            {title && (
              <>
                <span className="text-neutral-600">/</span>
                <span className="text-sm text-orange-400 truncate">{title}</span>
              </>
            )}
          </div>
          <button
            onClick={() => logout()}
            className="p-2 text-neutral-400 hover:text-red-500 transition-colors rounded"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>
        <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
      </div>
    </ProtectedRoute>
  )
}
