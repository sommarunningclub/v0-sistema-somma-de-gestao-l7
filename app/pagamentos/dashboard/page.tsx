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
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-wider">DASHBOARD DE PAGAMENTOS</h1>
          <p className="text-xs sm:text-sm text-neutral-400">Visão geral de receitas e métricas financeiras</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="bg-neutral-800 border border-neutral-600 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm flex-1 sm:flex-none"
          />
          <Button
            onClick={fetchMetrics}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm flex-1 sm:flex-none active:scale-95 md:active:scale-100"
            disabled={loading}
          >
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
            <span className="sm:hidden">Atualizar</span>
          </Button>
        </div>
      </div>

      {/* Cards Superiores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider mb-1">MRR (RECEITA RECORRENTE)</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white font-mono">
                  {loading ? "..." : formatCurrency(metrics?.mrr || 0)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider mb-1">ASSINATURAS ATIVAS</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white font-mono">
                  {loading ? "..." : metrics?.activeSubscriptions || 0}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-3 sm:p-4 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider mb-1">CHURN</p>
                <p className="text-lg sm:text-2xl md:text-3xl font-bold text-white font-mono">
                  {loading ? "..." : formatPercent(metrics?.churnRate || 0)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fluxo de Caixa Mensal */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
            FLUXO DE CAIXA MENSAL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 bg-neutral-800 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider">RECEBIDO</p>
                <p className="text-sm sm:text-lg md:text-2xl font-bold text-green-500 font-mono truncate">
                  {loading ? "..." : formatCurrency(metrics?.received || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 bg-neutral-800 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-yellow-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider">AGUARDANDO</p>
                <p className="text-sm sm:text-lg md:text-2xl font-bold text-yellow-500 font-mono truncate">
                  {loading ? "..." : formatCurrency(metrics?.awaiting || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 p-2 sm:p-3 md:p-4 bg-neutral-800 rounded-lg">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider">VENCIDOS</p>
                <p className="text-sm sm:text-lg md:text-2xl font-bold text-red-500 font-mono truncate">
                  {loading ? "..." : formatCurrency(metrics?.overdue || 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atenção Necessária */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
            ATENÇÃO NECESSÁRIA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
              <span className="text-green-500 text-xs sm:text-sm">Tudo em ordem! Nenhum alerta no momento.</span>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border ${
                    alert?.type === "error"
                      ? "bg-red-500/10 border-red-500/20"
                      : "bg-yellow-500/10 border-yellow-500/20"
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${alert?.type === "error" ? "text-red-500" : "text-yellow-500"}`}
                  />
                  <span className={`text-xs sm:text-sm ${alert?.type === "error" ? "text-red-500" : "text-yellow-500"}`}>
                    {alert?.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
              VISÃO DO MÊS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-xs sm:text-sm">Total Faturado</span>
                <span className="text-white font-mono font-bold text-xs sm:text-sm">
                  {formatCurrency((metrics?.received || 0) + (metrics?.awaiting || 0) + (metrics?.overdue || 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-xs sm:text-sm">Taxa de Recebimento</span>
                <span className="text-white font-mono font-bold text-xs sm:text-sm">
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
                <span className="text-neutral-400 text-xs sm:text-sm">Inadimplência</span>
                <span className="text-red-500 font-mono font-bold text-xs sm:text-sm">
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
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-neutral-300 tracking-wider">
              PROJEÇÃO ANUAL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-xs sm:text-sm">ARR Estimado</span>
                <span className="text-white font-mono font-bold text-xs sm:text-sm">
                  {formatCurrency((metrics?.mrr || 0) * 12)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-xs sm:text-sm">Ticket Médio</span>
                <span className="text-white font-mono font-bold text-xs sm:text-sm">
                  {metrics?.activeSubscriptions
                    ? formatCurrency((metrics?.mrr || 0) / metrics.activeSubscriptions)
                    : formatCurrency(0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400 text-xs sm:text-sm">LTV Médio (12 meses)</span>
                <span className="text-white font-mono font-bold text-xs sm:text-sm">
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
