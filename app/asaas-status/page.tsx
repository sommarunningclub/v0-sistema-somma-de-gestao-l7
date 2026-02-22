"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, RefreshCw, Loader2 } from "lucide-react"

interface StatusResponse {
  success: boolean
  message?: string
  error?: string
  data?: {
    totalCustomers: number
    apiConnected: boolean
    timestamp: string
  }
  config?: {
    apiKeyConfigured: boolean
    apiKeyLength: number
    walletIdConfigured: boolean
    walletId: string
    baseUrl: string
  }
  debug?: Record<string, unknown>
}

export default function AsaasStatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string>("")

  const checkStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/asaas/refresh")
      const data = await response.json()
      setStatus(data)
      setLastChecked(new Date().toLocaleString('pt-BR'))
    } catch (error) {
      setStatus({
        success: false,
        error: error instanceof Error ? error.message : "Erro ao verificar status"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkStatus()
  }, [])

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Status da Integração Asaas</h1>
            <p className="text-neutral-400 mt-1">
              Verificação em tempo real da conexão com a API
            </p>
          </div>
          <Button
            onClick={checkStatus}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Atualizar
          </Button>
        </div>

        {/* Status Principal */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {status?.success ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <span>Conectado</span>
                  <Badge className="bg-green-500/20 text-green-400">Online</Badge>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-500" />
                  <span>Desconectado</span>
                  <Badge className="bg-red-500/20 text-red-400">Offline</Badge>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.success && status.message && (
              <p className="text-green-400">{status.message}</p>
            )}
            {status?.error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-400 font-medium">Erro:</p>
                <p className="text-red-300 text-sm mt-1">{status.error}</p>
              </div>
            )}
            {lastChecked && (
              <p className="text-xs text-neutral-500">
                Última verificação: {lastChecked}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Configuração */}
        {status?.config && (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>Configuração</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <span className="text-neutral-300">API Key</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">
                      {status.config.apiKeyLength} caracteres
                    </span>
                    {status.config.apiKeyConfigured ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <span className="text-neutral-300">Wallet ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 font-mono">
                      {status.config.walletId || 'Não configurado'}
                    </span>
                    {status.config.walletIdConfigured ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <span className="text-neutral-300">Base URL</span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {status.config.baseUrl}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dados da API */}
        {status?.data && (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle>Dados da API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <span className="text-neutral-300">Total de Clientes</span>
                  <span className="text-2xl font-bold text-orange-500">
                    {status.data.totalCustomers}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-lg">
                  <span className="text-neutral-300">Status da Conexão</span>
                  {status.data.apiConnected ? (
                    <Badge className="bg-green-500/20 text-green-400">
                      Conectado
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/20 text-red-400">
                      Desconectado
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Debug Info */}
        {status?.debug && (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-sm">Informações de Debug</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-neutral-400 overflow-auto">
                {JSON.stringify(status.debug, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Instruções */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-sm">Instruções</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-400 space-y-2">
            <p>
              1. Se a conexão estiver offline, verifique se a variável <code className="text-orange-500">ASAAS_API_KEY</code> está configurada corretamente no Vercel
            </p>
            <p>
              2. Após adicionar ou atualizar a variável, aguarde alguns segundos e clique em "Atualizar"
            </p>
            <p>
              3. A API Key deve ter pelo menos 50 caracteres e começar com <code className="text-orange-500">$aact_</code>
            </p>
            <p>
              4. O Wallet ID deve estar no formato UUID: <code className="text-orange-500">ad3b1fb7-eda4-48b0-abb1-cd77a8ad3de6</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
