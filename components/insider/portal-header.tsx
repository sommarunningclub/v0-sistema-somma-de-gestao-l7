"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function PortalHeader({ nome }: { nome: string }) {
  const router = useRouter()
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const primeiroNome = String(nome ?? '').trim().split(' ')[0] || 'Insider'

  async function sair() {
    if (saindo) return
    setSaindo(true)
    setErro(null)
    try {
      const res = await fetch('/api/insiders/sair', { method: 'POST' })
      if (res.ok) {
        router.push('/insider')
        router.refresh()
        return
      }
      setErro('Não foi possível sair. Verifique sua conexão e tente novamente.')
    } catch {
      setErro('Não foi possível sair. Verifique sua conexão e tente novamente.')
    } finally {
      setSaindo(false)
    }
  }

  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#FF2C03]">
          Área do Insider
        </p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">
          Olá, {primeiroNome}
        </h1>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
        {erro ? (
          <p role="alert" className="max-w-[220px] text-right text-xs text-[#FF2C03]">
            {erro}
          </p>
        ) : null}
      </div>
    </header>
  )
}
