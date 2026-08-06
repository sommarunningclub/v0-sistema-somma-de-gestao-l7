"use client"

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { Beneficio } from '@/lib/insider/beneficios'

function CartaoCupom({ beneficio }: { beneficio: Beneficio }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(beneficio.valor)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Navegador sem permissão de área de transferência: o código segue
      // visível na tela para digitação manual.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3 text-left transition-colors hover:border-[#FF2C03]"
    >
      <span className="font-mono text-base font-semibold tracking-wide text-[#0A0A0A]">
        {beneficio.valor}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-[#737373]">
        {copiado ? <Check className="h-4 w-4 text-[#FF2C03]" /> : <Copy className="h-4 w-4" />}
        {copiado ? 'Copiado' : 'Copiar'}
      </span>
    </button>
  )
}

export function PortalBeneficios({ beneficios }: { beneficios: Beneficio[] }) {
  const visiveis = beneficios.filter((b) => b.disponivel)

  if (visiveis.length === 0) {
    return (
      <p className="text-sm text-[#737373]">
        Nenhum benefício cadastrado ainda. Fale com a equipe do Somma Club.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visiveis.map((b) => (
        <div key={b.chave} className="rounded-2xl bg-white p-5 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#737373]">
            {b.rotulo}
          </p>
          <div className="mt-3">
            {b.tipo === 'cupom' ? (
              <CartaoCupom beneficio={b} />
            ) : b.tipo === 'status' ? (
              <span
                className={
                  b.valor === 'Ativo'
                    ? 'inline-block rounded-full bg-[#FF2C03] px-3 py-1 text-sm font-semibold text-white'
                    : 'inline-block rounded-full bg-black/10 px-3 py-1 text-sm font-medium text-[#737373]'
                }
              >
                {b.valor}
              </span>
            ) : (
              <p className="text-base text-[#0A0A0A]">{b.valor}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
