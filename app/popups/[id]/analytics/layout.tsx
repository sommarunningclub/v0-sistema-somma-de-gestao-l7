'use client'

import ProtectedRoute from '@/components/protected-route'
import { OfflineBanner } from '@/hooks/use-online-status'

export default function PopupAnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <OfflineBanner />
      <div className="h-screen w-screen bg-black">{children}</div>
    </ProtectedRoute>
  )
}
