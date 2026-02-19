"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  Users,
  AlertTriangle,
  DollarSign,
  Clock,
  XCircle,
  CheckCircle,
  RefreshCw,
} from "lucide-react"
import { calculateDashboardMetrics } from "@/lib/services/payments"
import type { DashboardMetrics } from "@/lib/types/asaas"

export default function PaymentsDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  })

  const fetchMetrics = async () => {
    setLoading(true)
    const data = await calculateDashboardMetrics(currentMonth)
    setMetrics(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchMetrics()
  }, [currentMonth])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const alerts = [
    metrics?.overdue && metrics.overdue > 0
      ? { type: "warning", message: `${formatCurrency(metrics.overdue)} em cobranças vencidas` }
      : null,
    metrics?.churnRate && metrics.churnRate > 5
      ? { type: "error", message: `Churn elevado: ${formatPercent(metrics.churnRate)}` }
      : null,
  ].filter(Boolean)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">DASHBOARD DE PAGAMENTOS</h1>
          <p className="text-sm text-neutral-400">Visão geral de receitas e métricas financeiras</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="bg-neutral-800 border border-neutral-600 text-white px-3 py-2 rounded text-sm"
          />
          <Button
            onClick={fetchMetrics}
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards Superiores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider mb-1">MRR (RECEITA RECORRENTE)</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {loading ? "..." : formatCurrency(metrics?.mrr || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider mb-1">ASSINATURAS ATIVAS</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {loading ? "..." : metrics?.activeSubscriptions || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider mb-1">CHURN</p>
                <p className="text-3xl font-bold text-white font-mono">
                  {loading ? "..." : formatPercent(metrics?.churnRate || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fluxo de Caixa Mensal */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            FLUXO DE CAIXA MENSAL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">RECEBIDO</p>
                <p className="text-2xl font-bold text-green-500 font-mono">
                  {loading ? "..." : formatCurrency(metrics?.received || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">AGUARDANDO</p>
                <p className="text-2xl font-bold text-yellow-500 font-mono">
                  {loading ? "..." : formatCurrency(metrics?.awaiting || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-neutral-800 rounded-lg">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">VENCIDOS</p>
                <p className="text-2xl font-bold text-red-500 font-mono">
                  {loading ? "..." : formatCurrency(metrics?.overdue || 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atenção Necessária */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            ATENÇÃO NECESSÁRIA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-500">Tudo em ordem! Nenhum alerta no momento.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-4 rounded-lg border ${
                    alert?.type === "error"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-yellow-500/10 border-yellow-500/20"
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 ${alert?.type === "error" ? "text-red-500" : "text-yellow-500"}`}
                  />
                  <span className={alert?.type === "error" ? "text-red-500" : "text-yellow-500"}>
                    {alert?.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              VISÃO DO MÊS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Total Faturado</span>
                <span className="text-white font-mono font-bold">
                  {formatCurrency((metrics?.received || 0) + (metrics?.awaiting || 0) + (metrics?.overdue || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Taxa de Recebimento</span>
                <span className="text-white font-mono font-bold">
                  {metrics
                    ? formatPercent(
                        ((metrics.received || 0) /
                          ((metrics.received || 0) + (metrics.awaiting || 0) + (metrics.overdue || 0) || 1)) *
                          100
                      )
                    : "0%"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Inadimplência</span>
                <span className="text-red-500 font-mono font-bold">
                  {metrics
                    ? formatPercent(
                        ((metrics.overdue || 0) /
                          ((metrics.received || 0) + (metrics.awaiting || 0) + (metrics.overdue || 0) || 1)) *
                          100
                      )
                    : "0%"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              PROJEÇÃO ANUAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">ARR Estimado</span>
                <span className="text-white font-mono font-bold">
                  {formatCurrency((metrics?.mrr || 0) * 12)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Ticket Médio</span>
                <span className="text-white font-mono font-bold">
                  {metrics?.activeSubscriptions
                    ? formatCurrency((metrics?.mrr || 0) / metrics.activeSubscriptions)
                    : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">LTV Médio (12 meses)</span>
                <span className="text-white font-mono font-bold">
                  {metrics?.activeSubscriptions
                    ? formatCurrency(((metrics?.mrr || 0) / metrics.activeSubscriptions) * 12)
                    : formatCurrency(0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
