'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { getOverdueCharges, getUpcomingCharges } from '@/lib/services/charges'
import type { CobrancaMembro } from '@/lib/services/charges'

interface ChargesDashboardProps {
  compact?: boolean
}

export function ChargesDashboard({ compact = false }: ChargesDashboardProps) {
  const [overdueCharges, setOverdueCharges] = useState<CobrancaMembro[]>([])
  const [upcomingCharges, setUpcomingCharges] = useState<CobrancaMembro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCharges()
  }, [])

  const loadCharges = async () => {
    setLoading(true)
    const [overdue, upcoming] = await Promise.all([
      getOverdueCharges(),
      getUpcomingCharges()
    ])
    setOverdueCharges(overdue)
    setUpcomingCharges(upcoming)
    setLoading(false)
  }

  const totalOverdueValue = overdueCharges.reduce((sum, charge) => sum + charge.valor, 0)
  const totalUpcomingValue = upcomingCharges.reduce((sum, charge) => sum + charge.valor, 0)

  if (loading) {
    return <div className="text-neutral-400 text-sm">Carregando cobranças...</div>
  }

  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Overdue */}
        <Card className="bg-neutral-900 border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {overdueCharges.length}
            </div>
            <p className="text-xs text-red-300 mt-1">
              R$ {totalOverdueValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card className="bg-neutral-900 border-yellow-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-400">
              <Clock className="w-4 h-4" />
              Próximas (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {upcomingCharges.length}
            </div>
            <p className="text-xs text-yellow-300 mt-1">
              R$ {totalUpcomingValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-neutral-900 border-red-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {overdueCharges.length}
            </div>
            <p className="text-sm text-red-300 mt-2">
              Total: R$ {totalOverdueValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-yellow-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-400">
              <Clock className="w-4 h-4" />
              Próximas (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {upcomingCharges.length}
            </div>
            <p className="text-sm text-yellow-300 mt-2">
              Total: R$ {totalUpcomingValue.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-neutral-300">
              Total Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              R$ {(totalOverdueValue + totalUpcomingValue).toFixed(2)}
            </div>
            <p className="text-sm text-neutral-400 mt-2">
              {overdueCharges.length + upcomingCharges.length} cobranças
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Charges List */}
      {overdueCharges.length > 0 && (
        <Card className="bg-neutral-900 border-red-900/50">
          <CardHeader>
            <CardTitle className="text-base text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Cobranças Atrasadas ({overdueCharges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {overdueCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="p-3 bg-red-900/20 border border-red-900/30 rounded-lg flex justify-between items-start"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {charge.descricao}
                    </p>
                    <p className="text-xs text-red-300 mt-1">
                      Venceu em: {new Date(charge.data_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-400">
                      R$ {charge.valor.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Charges List */}
      {upcomingCharges.length > 0 && (
        <Card className="bg-neutral-900 border-yellow-900/50">
          <CardHeader>
            <CardTitle className="text-base text-yellow-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Próximas Cobranças ({upcomingCharges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {upcomingCharges.map((charge) => (
                <div
                  key={charge.id}
                  className="p-3 bg-yellow-900/20 border border-yellow-900/30 rounded-lg flex justify-between items-start"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {charge.descricao}
                    </p>
                    <p className="text-xs text-yellow-300 mt-1">
                      Vence em: {new Date(charge.data_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-yellow-400">
                      R$ {charge.valor.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueCharges.length === 0 && upcomingCharges.length === 0 && (
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium">Nenhuma cobrança pendente</p>
            <p className="text-neutral-400 text-sm mt-1">Todas as cobranças estão em dia</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
