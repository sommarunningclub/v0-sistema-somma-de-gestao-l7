'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, UserX, Loader2 } from 'lucide-react'

export interface CustomerStats {
  totalCustomers: number
  activeCustomers: number
  inactiveCustomers: number
  lastSyncDate?: string
  isLoading?: boolean
}

interface CustomerStatsProps {
  stats: CustomerStats
}

export function CustomerStats({ stats }: CustomerStatsProps) {
  const inactiveCount = stats.totalCustomers - stats.activeCustomers

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Customers Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalCustomers}</div>
          <p className="text-xs text-muted-foreground">
            Clientes cadastrados no Asaas
          </p>
        </CardContent>
      </Card>

      {/* Active Customers Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
          <UserCheck className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.activeCustomers}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.totalCustomers > 0
              ? `${((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1)}% do total`
              : 'Nenhum ativo'}
          </p>
        </CardContent>
      </Card>

      {/* Inactive Customers Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Clientes Inativos</CardTitle>
          <UserX className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{inactiveCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.totalCustomers > 0
              ? `${((inactiveCount / stats.totalCustomers) * 100).toFixed(1)}% do total`
              : 'Nenhum inativo'}
          </p>
        </CardContent>
      </Card>

      {/* Last Sync Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Última Sincronização</CardTitle>
          {stats.isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardHeader>
        <CardContent>
          <div className="text-sm font-semibold">
            {stats.lastSyncDate
              ? new Date(stats.lastSyncDate).toLocaleDateString('pt-BR', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Nunca'}
          </div>
          <p className="text-xs text-muted-foreground">
            {stats.lastSyncDate
              ? `Há ${Math.floor(
                  (Date.now() - new Date(stats.lastSyncDate).getTime()) / 60000
                )} minutos`
              : 'Nenhuma sincronização'}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
