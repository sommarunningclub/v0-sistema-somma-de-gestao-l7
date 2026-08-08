'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, ListChecks } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { EscalaCalendario } from '@/components/escala-calendario'
import { EscalaDiaPanel } from '@/components/escala-dia-panel'
import { EscalaAtividadesManager } from '@/components/escala-atividades-manager'
import { ErrorBanner } from '@/components/ui/error-banner'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader, PageShell, Skeleton } from '@/components/somma'
import type { EscalaDiaResumo } from '@/lib/types/escala'

export default function EscalaPage() {
  const hoje = useMemo(() => new Date(), [])
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [dias, setDias] = useState<EscalaDiaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(null)
  const [mostrarAtividades, setMostrarAtividades] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const mesParam = `${ano}-${String(mes).padStart(2, '0')}`
      const res = await apiFetch(`/api/escala?mes=${mesParam}`)
      if (!res.ok) throw new Error('Não foi possível carregar a escala do mês')
      setDias(await res.json())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar a escala')
    } finally {
      setLoading(false)
    }
  }, [ano, mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operação"
        title="Escala"
        description="Quem corre, quem apoia e quem não vai — evento por evento, mês a mês."
        meta={
          loading ? null : (
            <span>
              <span className="font-mono tabular-nums text-ink">{dias.length}</span>{' '}
              evento(s) neste mês
            </span>
          )
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => setMostrarAtividades(true)}>
            <ListChecks aria-hidden="true" />
            Atividades
          </Button>
        }
      />

      <div className="space-y-4">
        {erro ? <ErrorBanner message={erro} onRetry={carregar} /> : null}

        {loading ? (
          <div aria-busy="true" className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-[420px] w-full rounded-xl" />
          </div>
        ) : (
          <EscalaCalendario
            ano={ano}
            mes={mes}
            dias={dias}
            onMudarMes={(novoAno, novoMes) => {
              setAno(novoAno)
              setMes(novoMes)
            }}
            onSelecionarDia={(dia) => setEventoSelecionado(dia.evento_id)}
          />
        )}

        {dias.length === 0 && !loading && !erro ? (
          <EmptyState
            icon={CalendarRange}
            title="Nenhum evento neste mês"
            description="Cadastre um treino no módulo Eventos para poder escalar insiders."
          />
        ) : null}
      </div>

      {eventoSelecionado ? (
        <EscalaDiaPanel
          eventoId={eventoSelecionado}
          onFechar={() => setEventoSelecionado(null)}
          onAlterado={carregar}
        />
      ) : null}

      {mostrarAtividades ? (
        <EscalaAtividadesManager onFechar={() => setMostrarAtividades(false)} />
      ) : null}
    </PageShell>
  )
}
