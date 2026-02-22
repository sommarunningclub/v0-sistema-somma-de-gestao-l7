"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase-client"
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  UserCheck, 
  AlertCircle,
  Award,
  Briefcase
} from "lucide-react"

interface DashboardMetrics {
  totalCustomers: number
  activeSubscriptions: number
  totalProfessors: number
  linkedClients: number
  pendingPayments: number
  pendingPaymentsValue: number
  totalRevenue: number
  overduePayments: number
  recentActivity: Array<{
    type: string
    description: string
    timestamp: string
  }>
}

export default function CommandCenterPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalCustomers: 0,
    activeSubscriptions: 0,
    totalProfessors: 0,
    linkedClients: 0,
    pendingPayments: 0,
    pendingPaymentsValue: 0,
    totalRevenue: 0,
    overduePayments: 0,
    recentActivity: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardMetrics()
  }, [])

  const fetchDashboardMetrics = async () => {
    setLoading(true)
    console.log("[v0] Fetching dashboard metrics...")

    try {
      // Buscar total de clientes do Asaas
      const customersRes = await fetch("/api/asaas?endpoint=/customers&limit=100")
      let totalCustomers = 0
      if (customersRes.ok) {
        const customersData = await customersRes.json()
        totalCustomers = customersData.data?.length || 0
      }

      // Buscar assinaturas ativas do Asaas
      const subscriptionsRes = await fetch("/api/asaas?endpoint=/subscriptions&limit=100")
      let activeSubscriptions = 0
      let totalRevenue = 0
      if (subscriptionsRes.ok) {
        const subsData = await subscriptionsRes.json()
        const activeSubs = (subsData.data || []).filter((s: any) => s.status === "ACTIVE")
        activeSubscriptions = activeSubs.length
        totalRevenue = activeSubs.reduce((sum: number, s: any) => sum + (s.value || 0), 0)
      }

      // Buscar professores do Supabase
      const { data: professorsData } = await supabase
        .from("professors")
        .select("*")
        .eq("status", "active")

      const totalProfessors = professorsData?.length || 0

      // Buscar clientes vinculados
      const { data: linkedData } = await supabase
        .from("professor_clients")
        .select("*")
        .eq("status", "active")

      const linkedClients = linkedData?.length || 0

      // Buscar pagamentos pendentes
      const { data: pendingData } = await supabase
        .from("payments")
        .select("*")
        .eq("status", "PENDING")

      const pendingPayments = pendingData?.length || 0
      const pendingPaymentsValue = pendingData?.reduce((sum, p) => sum + (p.value || 0), 0) || 0

      // Buscar pagamentos vencidos (status OVERDUE)
      const { data: overdueData } = await supabase
        .from("payments")
        .select("*")
        .eq("status", "OVERDUE")

      const overduePayments = overdueData?.length || 0

      // Buscar atividades recentes (últimas transações, novos membros, etc)
      const { data: recentTransactions } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5)

      const recentActivity = (recentTransactions || []).map(t => ({
        type: t.transaction_type || "transaction",
        description: t.description || "Transação financeira",
        timestamp: new Date(t.created_at).toLocaleString("pt-BR")
      }))

      setMetrics({
        totalCustomers,
        activeSubscriptions,
        totalProfessors,
        linkedClients,
        pendingPayments,
        pendingPaymentsValue,
        totalRevenue,
        overduePayments,
        recentActivity
      })

      console.log("[v0] Dashboard metrics loaded:", {
        totalCustomers,
        activeSubscriptions,
        totalProfessors,
        linkedClients
      })
    } catch (error) {
      console.error("[v0] Error fetching dashboard metrics:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-500/20 mb-4">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-sm text-neutral-400">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col overflow-auto">
      {/* Main Content - Mobile Optimized */}
      <div className="flex flex-col p-3 sm:p-4 md:p-6 lg:p-8 gap-3 sm:gap-4 md:gap-6">
        {/* Header - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8 pt-2 pb-2 mb-2">
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-wider">DASHBOARD</h1>
          <p className="text-xs sm:text-sm text-neutral-400">Resumo das métricas</p>
        </div>

        {/* Main Metrics Grid - Mobile Optimized */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
          {/* Total Clientes */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">CLIENTES</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.totalCustomers}</p>
              </div>
            </CardContent>
          </Card>

          {/* Assinaturas Ativas */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">ASSINATURA</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.activeSubscriptions}</p>
              </div>
            </CardContent>
          </Card>

          {/* Receita Mensal */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">RECEITA</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono truncate">
                  R$ {(metrics.totalRevenue / 1000).toFixed(1)}K
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Professores Ativos */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex flex-col gap-1 sm:gap-1.5">
                <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">PROF.</p>
                <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.totalProfessors}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics - Stacked on mobile */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
          {/* Cobranças Pendentes */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">PENDENTES</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.pendingPayments}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-neutral-400">R$:</span>
                <span className="font-bold text-white font-mono">{metrics.pendingPaymentsValue.toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pagamentos Vencidos */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">VENCIDOS</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.overduePayments}</p>
                </div>
              </div>
              <Badge className="bg-red-500/20 text-red-500 text-[10px] sm:text-xs">
                Atenção
              </Badge>
            </CardContent>
          </Card>

          {/* Clientes Vinculados */}
          <Card className="bg-neutral-900 border-neutral-700 hover:border-orange-500/50 transition-colors">
            <CardContent className="p-3 sm:p-4 md:p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-neutral-400 tracking-wider truncate">VINCULADOS</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white font-mono">{metrics.linkedClients}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-neutral-400">Taxa:</span>
                <span className="font-bold text-white font-mono">
                  {metrics.totalCustomers > 0 
                    ? ((metrics.linkedClients / metrics.totalCustomers) * 100).toFixed(0)
                    : 0}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts & Activity - Hidden on mobile, shown on tablet+ */}
        <div className="hidden md:grid md:grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Recent Activity */}
          <Card className="bg-neutral-900 border-neutral-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-white tracking-wider">
                ATIVIDADES RECENTES
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics.recentActivity.length === 0 ? (
                <div className="text-center py-8 text-neutral-400 text-sm">
                  Nenhuma atividade
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-neutral-800 rounded hover:bg-neutral-750 transition-colors"
                    >
                      <div className="w-2 h-2 mt-1.5 bg-orange-500 rounded-full flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{activity.description}</p>
                        <p className="text-xs text-neutral-400 mt-1">{activity.timestamp}</p>
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-400 text-xs flex-shrink-0">
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold text-white tracking-wider">
                ESTATÍSTICAS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded text-sm">
                  <span className="text-neutral-300">Taxa de Conversão</span>
                  <span className="font-bold text-white">
                    {metrics.totalCustomers > 0 
                      ? ((metrics.activeSubscriptions / metrics.totalCustomers) * 100).toFixed(1)
                      : 0}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded text-sm">
                  <span className="text-neutral-300">Ticket Médio</span>
                  <span className="font-bold text-white">
                    R$ {metrics.activeSubscriptions > 0 
                      ? (metrics.totalRevenue / metrics.activeSubscriptions).toFixed(0)
                      : "0"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded text-sm">
                  <span className="text-neutral-300">Clientes/Prof</span>
                  <span className="font-bold text-white">
                    {metrics.totalProfessors > 0 
                      ? (metrics.linkedClients / metrics.totalProfessors).toFixed(1)
                      : 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded text-sm">
                  <span className="text-neutral-300">Professores</span>
                  <span className="font-bold text-white">{metrics.totalProfessors}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
