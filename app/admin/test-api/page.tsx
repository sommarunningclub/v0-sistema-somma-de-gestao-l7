"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react"

export default function TestAPIPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [details, setDetails] = useState<Record<string, unknown>>({})

  const testAPI = async () => {
    setStatus("loading")
    setMessage("Testando conexão com API Asaas...")
    setDetails({})

    try {
      // Tentar buscar alguns clientes
      const response = await fetch("/api/asaas?endpoint=/customers&limit=1")
      
      if (response.ok) {
        const data = await response.json()
        setStatus("success")
        setMessage("✅ API Asaas está funcionando corretamente!")
        setDetails({
          "Total de registros": data.totalCount || "N/A",
          "Primeiros dados": JSON.stringify(data.data?.[0], null, 2) || "Sem dados",
          "Timestamp": new Date().toLocaleTimeString(),
        })
      } else {
        const error = await response.text()
        setStatus("error")
        setMessage(`❌ Erro na API: ${response.status}`)
        setDetails({
          "Status": response.status,
          "Mensagem": error,
          "Timestamp": new Date().toLocaleTimeString(),
        })
      }
    } catch (err) {
      setStatus("error")
      setMessage("❌ Erro ao conectar com a API")
      setDetails({
        "Erro": String(err),
        "Timestamp": new Date().toLocaleTimeString(),
      })
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔧 Teste de Conexão API Asaas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={testAPI}
            disabled={status === "loading"}
            className="w-full"
          >
            {status === "loading" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Testar Conexão
          </Button>

          {status !== "idle" && (
            <div className={`p-4 rounded-lg border ${
              status === "success" 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-red-500/10 border-red-500/30"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {status === "success" ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={status === "success" ? "text-green-500" : "text-red-500"}>
                  {message}
                </span>
              </div>

              {Object.entries(details).length > 0 && (
                <div className="mt-4 p-3 bg-neutral-800 rounded text-xs text-neutral-300 overflow-auto max-h-64">
                  <pre>{JSON.stringify(details, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          <div className="p-4 bg-neutral-800 rounded-lg text-xs text-neutral-400">
            <p className="font-bold mb-2">📋 Instruções:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Clique no botão acima para testar a conexão com a API Asaas</li>
              <li>Se receber "API Asaas está funcionando", a chave está correta</li>
              <li>Se receber erro, verifique se a nova ASAAS_API_KEY foi adicionada nas variáveis de ambiente</li>
              <li>Pode ser necessário fazer redeploy da aplicação após atualizar as variáveis</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
