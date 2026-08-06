import type React from 'react'
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'

const geist = Geist({ subsets: ['latin'], variable: '--font-insider-sans' })

export const metadata: Metadata = {
  title: 'Cadastro Insider — Somma Club',
  description: 'Atualize seus dados de Insider do Somma Club.',
}

export default function InsiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${geist.variable} min-h-screen bg-[#0A0A0A] text-white`}
      style={{ fontFamily: 'var(--font-insider-sans), system-ui, sans-serif' }}
    >
      {children}
    </div>
  )
}
