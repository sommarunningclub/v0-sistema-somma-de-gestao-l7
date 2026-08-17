"use client"

import { useCallback, useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"

import { apiFetch } from "@/lib/api-client"
import { ErrorBanner } from "@/components/ui/error-banner"
import { PageHeader, PageShell } from "@/components/somma"
import { EscalaInsidersPanel } from "@/components/dashboard/escala-insiders-panel"
import { PresencaEventosPanel } from "@/components/dashboard/presenca-eventos-panel"
import { PresencaInsidersPanel } from "@/components/dashboard/presenca-insiders-panel"
import { ProximosEventosPanel } from "@/components/dashboard/proximos-eventos-panel"
import { TopCheckinsPanel } from "@/components/dashboard/top-checkins-panel"
import type { DashboardBlocos } from "@/components/dashboard/types"

/*
 * O dashboard é 100% operacional por decisão de produto: nenhuma informação
 * financeira (cobranças, pagamentos, receita, Asaas) aparece aqui nem em
 * qualquer outra tela. O centro da página são os blocos de comunidade
 * e operação — check-ins, presença de membros e insiders, escala e agenda.
 */

type DashboardMetricsResponse = DashboardBlocos

const EMPTY_BLOCOS: DashboardBlocos = {
  topCheckins: null,
  presencaEventos: null,
  presencaInsiders: null,
  escalaInsiders: null,
  proximosEventos: null,
}

export default function CommandCenterPage() {
  const [blocos, setBlocos] = useState<DashboardBlocos>(EMPTY_BLOCOS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch("/api/command-center/metrics")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || `Falha ao carregar o dashboard (HTTP ${res.status})`)
      }
      const data: DashboardMetricsResponse = await res.json()

      setBlocos({
        topCheckins: data.topCheckins ?? null,
        presencaEventos: data.presencaEventos ?? null,
        presencaInsiders: data.presencaInsiders ?? null,
        escalaInsiders: data.escalaInsiders ?? null,
        proximosEventos: data.proximosEventos ?? null,
      })
      setUpdatedAt(new Date().toLocaleString("pt-BR"))
      setError(null)
    } catch (err) {
      console.error("[command-center] Erro ao carregar o dashboard:", err)
      setError("Erro ao carregar o dashboard")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Visão geral"
        title="Dashboard"
        description="O pulso do clube: presença nos eventos, ranking dos insiders, escala e a agenda do que vem por aí."
        meta={
          updatedAt ? <span>Atualizado em {updatedAt}</span> : <span>Carregando…</span>
        }
        actions={
          <button
            type="button"
            onClick={() => void fetchDashboard()}
            disabled={loading}
            className="ds-tap inline-flex items-center gap-2 rounded border border-line bg-surface-hover px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-ink-strong disabled:opacity-60"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
            />
            Atualizar
          </button>
        }
      />

      {error ? (
        <div className="mb-5">
          <ErrorBanner message={error} onRetry={fetchDashboard} />
        </div>
      ) : null}

      <section aria-labelledby="comunidade-operacao">
        {/*
          Heading apenas para leitores de tela: com uma seção só na página, um
          título visível repetiria o "Dashboard" do cabeçalho sem informar nada.
        */}
        <h2 id="comunidade-operacao" className="sr-only">
          Comunidade e operação
        </h2>
        {/*
          `items-start`: sem isso, o painel curto (o destaque de um membro só)
          era esticado até a altura do Top 10 e deixava meia tela vazia.
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <TopCheckinsPanel bloco={blocos.topCheckins} loading={loading} />
          <PresencaEventosPanel bloco={blocos.presencaEventos} loading={loading} />
          <PresencaInsidersPanel bloco={blocos.presencaInsiders} loading={loading} />
          <EscalaInsidersPanel bloco={blocos.escalaInsiders} loading={loading} />
          <ProximosEventosPanel bloco={blocos.proximosEventos} loading={loading} />
        </div>
      </section>
    </PageShell>
  )
}
