'use client'

import { AuthenticatedChrome } from '@/components/authenticated-chrome'

export default function PopupAnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthenticatedChrome
      backHref="/?section=popups"
      backLabel="Voltar para Pop-ups"
      title="Analytics do pop-up"
    >
      <div className="scroll-touch h-full overflow-y-auto">{children}</div>
    </AuthenticatedChrome>
  )
}
