'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildDashboardUrl } from '@/lib/auth/page-routes'
import { NpsRodadas } from '@/components/nps/nps-rodadas'
import { NpsRodadaDetalhe, ABAS_RODADA, type AbaRodada } from '@/components/nps/nps-rodada-detalhe'

/**
 * Módulo NPS Assessoria.
 *
 * Duas telas: a lista de rodadas (com o histórico) e o detalhe de uma rodada.
 * A rodada aberta e a aba vivem na URL (`?section=nps&rodada=<id>&aba=…`), então
 * dá para mandar o link de um relatório para outra pessoa do time.
 */
export function NpsModule() {
  const router = useRouter()
  const params = useSearchParams()

  const rodadaId = params.get('rodada')
  const abaParam = params.get('aba') as AbaRodada | null
  const aba: AbaRodada = abaParam && ABAS_RODADA.includes(abaParam) ? abaParam : 'resultados'

  const navegar = useCallback(
    (id: string | null, novaAba?: AbaRodada) => {
      const extra: Record<string, string> = {}
      if (id) {
        extra.rodada = id
        if (novaAba && novaAba !== 'resultados') extra.aba = novaAba
      }
      router.replace(buildDashboardUrl('nps', undefined, extra), { scroll: false })
    },
    [router],
  )

  if (rodadaId) {
    return (
      <NpsRodadaDetalhe
        key={rodadaId}
        id={rodadaId}
        aba={aba}
        onAba={(novaAba) => navegar(rodadaId, novaAba)}
        onVoltar={() => navegar(null)}
      />
    )
  }

  return <NpsRodadas onAbrir={(id, novaAba) => navegar(id, novaAba)} />
}
