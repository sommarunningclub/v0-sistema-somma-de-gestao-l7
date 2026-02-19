"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  Cloud,
  ArrowDownUp,
  AlertTriangle,
} from "lucide-react"
import { supabase } from "@/lib/supabase-client"

interface SyncLog {
  id: number
  entity_type: string
  entity_id: string
  action: string
  status: string
  error_message: string | null
  created_at: string
  updated_at: string
}

interface SyncStats {
  entity_type: string
  total_syncs: number
  successful: number
  failed: number
  last_sync_time: string | null
}

export default function Sincronizacao() {
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [syncStats, setSyncStats] = useState<SyncStats[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<string>("")

  const fetchData = async () => {
    setLoading(true)
    try {
      // Buscar logs de sincronização
      const { data: logs, error: logsError } = await supabase
        .from("sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (logsError) {
        console.error("[v0] Error fetching sync logs:", logsError)
      } else {
        setSyncLogs(logs || [])
      }

      // Buscar estatísticas de sincronização
      const { data: stats, error: statsError } = await supabase
        .from("vw_last_syncs")
        .select("*")

      if (statsError) {
        console.error("[v0] Error fetching sync stats:", statsError)
      } else {
        setSyncStats(stats || [])
      }
    } catch (err) {
      console.error("[v0] Unexpected error:", err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncProgress("Iniciando sincronização...")

    try {
      // Sincronizar Clientes
      setSyncProgress("Sincronizando clientes...")
      const customersResponse = await fetch("/api/asaas?endpoint=/customers&limit=100")
      if (customersResponse.ok) {
        const customersData = await customersResponse.json()
        const customers = customersData.data || []

        for (const customer of customers) {
          // Verificar se já existe
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("asaas_id", customer.id)
            .single()

          if (!existing) {
            await supabase.from("customers").insert([{
              asaas_id: customer.id,
              name: customer.name,
              cpf_cnpj: customer.cpfCnpj,
              email: customer.email,
              phone: customer.mobilePhone || customer.phone,
              address: customer.address,
              city: customer.city,
              state: customer.state,
              postal_code: customer.postalCode,
              raw_data: customer,
            }])
          } else {
            await supabase.from("customers").update({
              name: customer.name,
              email: customer.email,
              phone: customer.mobilePhone || customer.phone,
              raw_data: customer,
              updated_at: new Date().toISOString(),
            }).eq("asaas_id", customer.id)
          }
        }

        await supabase.from("sync_log").insert([{
          entity_type: "customers",
          entity_id: "bulk",
          action: "sync",
          status: "success",
        }])
      }

      // Sincronizar Pagamentos
      setSyncProgress("Sincronizando cobranças...")
      const paymentsResponse = await fetch("/api/asaas?endpoint=/payments&limit=100")
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json()
        const payments = paymentsData.data || []

        for (const payment of payments) {
          const { data: existing } = await supabase
            .from("payments")
            .select("id")
            .eq("asaas_id", payment.id)
            .single()

          if (!existing) {
            await supabase.from("payments").insert([{
              asaas_id: payment.id,
              customer_asaas_id: payment.customer,
              value: payment.value,
              net_value: payment.netValue,
              description: payment.description,
              billing_type: payment.billingType,
              status: payment.status,
              due_date: payment.dueDate,
              payment_date: payment.paymentDate,
              confirmed_date: payment.confirmedDate,
              credit_date: payment.creditDate,
              external_reference: payment.externalReference,
              raw_data: payment,
            }])
          } else {
            await supabase.from("payments").update({
              status: payment.status,
              payment_date: payment.paymentDate,
              confirmed_date: payment.confirmedDate,
              credit_date: payment.creditDate,
              net_value: payment.netValue,
              raw_data: payment,
              updated_at: new Date().toISOString(),
            }).eq("asaas_id", payment.id)
          }
        }

        await supabase.from("sync_log").insert([{
          entity_type: "payments",
          entity_id: "bulk",
          action: "sync",
          status: "success",
        }])
      }

      setSyncProgress("Sincronização concluída!")
      fetchData()
    } catch (err) {
      console.error("[v0] Sync error:", err)
      setSyncProgress("Erro na sincronização")
      await supabase.from("sync_log").insert([{
        entity_type: "general",
        entity_id: "bulk",
        action: "sync",
        status: "error",
        error_message: err instanceof Error ? err.message : "Unknown error",
      }])
    }

    setTimeout(() => {
      setSyncing(false)
      setSyncProgress("")
    }, 2000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500/20 text-green-400"
      case "error":
        return "bg-red-500/20 text-red-400"
      case "pending":
        return "bg-yellow-500/20 text-yellow-400"
      default:
        return "bg-neutral-500/20 text-neutral-400"
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-"
    return new Date(dateString).toLocaleString("pt-BR")
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "customers":
        return <Database className="w-4 h-4" />
      case "payments":
        return <ArrowDownUp className="w-4 h-4" />
      default:
        return <Cloud className="w-4 h-4" />
    }
  }

  const getEntityLabel = (type: string) => {
    const labels: Record<string, string> = {
      customers: "Clientes",
      payments: "Cobranças",
      subscriptions: "Assinaturas",
      general: "Geral",
    }
    return labels[type] || type
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">SINCRONIZAÇÃO ASAAS</h1>
          <p className="text-sm text-neutral-400">Conciliar dados entre o sistema e o Asaas</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Asaas"}
        </Button>
      </div>

      {/* Progress */}
      {syncProgress && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-orange-500 animate-spin" />
              <span className="text-orange-500">{syncProgress}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {["customers", "payments", "subscriptions"].map((entityType) => {
          const stat = syncStats.find((s) => s.entity_type === entityType) || {
            total_syncs: 0,
            successful: 0,
            failed: 0,
            last_sync_time: null,
          }

          return (
            <Card key={entityType} className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                      {getEntityIcon(entityType)}
                    </div>
                    <h3 className="text-sm font-medium text-white tracking-wider">
                      {getEntityLabel(entityType).toUpperCase()}
                    </h3>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Total de Syncs</span>
                    <span className="text-white font-mono">{stat.total_syncs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Sucesso</span>
                    <span className="text-green-500 font-mono">{stat.successful}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Falhas</span>
                    <span className="text-red-500 font-mono">{stat.failed}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-neutral-700">
                    <span className="text-neutral-400">Última Sync</span>
                    <span className="text-neutral-300 text-xs">
                      {stat.last_sync_time ? formatDate(stat.last_sync_time) : "Nunca"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Informações */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            COMO FUNCIONA A SINCRONIZAÇÃO
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-neutral-800 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Cloud className="w-5 h-5 text-orange-500" />
                <span className="text-white font-medium">Sincronização Manual</span>
              </div>
              <p className="text-sm text-neutral-400">
                Ao clicar em &quot;Sincronizar Asaas&quot;, o sistema busca todos os clientes e cobranças do Asaas e
                atualiza o banco local, corrigindo divergências.
              </p>
            </div>

            <div className="p-4 bg-neutral-800 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <ArrowDownUp className="w-5 h-5 text-green-500" />
                <span className="text-white font-medium">Webhooks (Automático)</span>
              </div>
              <p className="text-sm text-neutral-400">
                Eventos do Asaas (pagamentos, assinaturas) atualizam o banco automaticamente via webhook, mantendo os
                dados sempre em sincronia.
              </p>
            </div>
          </div>

          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-sm text-yellow-500">
                <strong>Importante:</strong> O banco local é a fonte de verdade. O Asaas é apenas o gateway de
                pagamentos. A sincronização garante que ambos estejam alinhados.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log de Sincronização */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
            LOG DE SINCRONIZAÇÃO
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Carregando logs...</p>
            </div>
          ) : syncLogs.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-400">Nenhum log de sincronização encontrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-700">
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      DATA/HORA
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      ENTIDADE
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      AÇÃO
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      STATUS
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-neutral-400 tracking-wider">
                      DETALHES
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {syncLogs.map((log, index) => (
                    <tr
                      key={log.id}
                      className={`border-b border-neutral-800 ${
                        index % 2 === 0 ? "bg-neutral-900" : "bg-neutral-850"
                      }`}
                    >
                      <td className="py-3 px-4 text-sm text-neutral-300">{formatDate(log.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-neutral-300">
                          {getEntityIcon(log.entity_type)}
                          <span className="text-sm">{getEntityLabel(log.entity_type)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-300">{log.action}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(log.status)}>
                          {log.status === "success" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {log.status === "error" && <XCircle className="w-3 h-3 mr-1" />}
                          {log.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-neutral-400">
                        {log.error_message || log.entity_id || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
