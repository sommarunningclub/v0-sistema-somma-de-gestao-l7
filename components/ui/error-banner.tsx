'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorBanner({ message, onRetry, className = '' }: ErrorBannerProps) {
  return (
    <div className={`flex items-center justify-between gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-400 truncate">{message}</p>
      </div>
      {onRetry && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onRetry}
          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0 h-8"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
