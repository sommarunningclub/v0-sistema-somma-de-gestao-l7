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
      style={{
        fontFamily: 'var(--font-insider-sans), system-ui, sans-serif',
        /*
         * O painel declara `color-scheme: dark` no `html` para que barras de
         * rolagem e controles nativos acompanhem o tema escuro. O portal do
         * Insider, porém, usa cartões brancos — herdar `dark` faz o navegador
         * pintar inputs sem `background` explícito de preto sobre branco.
         * Aqui a subárvore volta para `light`.
         */
        colorScheme: 'light',
      }}
    >
      {children}
    </div>
  )
}
