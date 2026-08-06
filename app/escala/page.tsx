'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { EscalaCalendario } from '@/components/escala-calendario'
import { EscalaDiaPanel } from '@/components/escala-dia-panel'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import type { EscalaDiaResumo } from '@/lib/types/escala'

export default function EscalaPage() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [dias, setDias] = useState<EscalaDiaResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [eventoSelecionado, setEventoSelecionado] = useState<string | null>(null)

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
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-orange-500" />
        <h1 className="text-white font-bold text-xl">Escala</h1>
      </div>

      {erro && <ErrorBanner message={erro} onRetry={carregar} />}

      {loading ? (
        <PageLoading label="Carregando escala..." />
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

      {dias.length === 0 && !loading && !erro && (
        <p className="text-sm text-neutral-500">
          Nenhum evento neste mês. Cadastre um treino no módulo Eventos para poder escalar insiders.
        </p>
      )}

      {eventoSelecionado && (
        <EscalaDiaPanel
          eventoId={eventoSelecionado}
          onFechar={() => setEventoSelecionado(null)}
          onAlterado={carregar}
        />
      )}
    </div>
  )
}
