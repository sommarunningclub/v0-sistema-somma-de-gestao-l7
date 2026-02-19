"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, Loader2, Ticket } from "lucide-react"

export default function TestCouponPage() {
  const [code, setCode] = useState("")
  const [value, setValue] = useState("100")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState("")

  const testCoupon = async () => {
    if (!code.trim()) {
      setError("Digite um codigo de cupom")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch(
        `/api/checkout/validate-coupon?code=${encodeURIComponent(code)}&value=${value}`
      )
      const data = await response.json()
      
      console.log("[v0] Coupon validation result:", data)
      setResult(data)
      
      if (!data.valid) {
        setError(data.error || "Cupom invalido")
      }
    } catch (err) {
      console.error("[v0] Error testing coupon:", err)
      setError("Erro ao validar cupom")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-8 flex items-center justify-center">
      <Card className="w-full max-w-lg bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Ticket className="w-5 h-5 text-orange-500" />
            Teste de Validacao de Cupom
          </CardTitle>
          <p className="text-sm text-neutral-400">
            Endpoint: /api/checkout/validate-coupon
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs text-neutral-400 block mb-1">CODIGO DO CUPOM</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex: DESCONTO10"
              className="bg-neutral-800 border-neutral-600 text-white"
            />
          </div>

          <div>
            <label className="text-xs text-neutral-400 block mb-1">VALOR DO PEDIDO (R$)</label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="100"
              className="bg-neutral-800 border-neutral-600 text-white"
            />
          </div>

          <Button
            onClick={testCoupon}
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validando...
              </>
            ) : (
              "Validar Cupom"
            )}
          </Button>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {result?.valid && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm">Cupom valido!</span>
              </div>

              <div className="p-4 bg-neutral-800 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Cupom:</span>
                  <span className="text-white font-mono">{(result.coupon as Record<string, unknown>)?.code as string}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Descricao:</span>
                  <span className="text-white">{(result.coupon as Record<string, unknown>)?.description as string}</span>
                </div>
                {result.calculation && (
                  <>
                    <div className="border-t border-neutral-700 my-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Valor Original:</span>
                      <span className="text-white">R$ {((result.calculation as Record<string, unknown>)?.originalValue as number)?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Desconto:</span>
                      <span className="text-green-400">- R$ {((result.calculation as Record<string, unknown>)?.discount as number)?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-neutral-400">Valor Final:</span>
                      <span className="text-orange-500">R$ {((result.calculation as Record<string, unknown>)?.finalValue as number)?.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 mb-2">Objeto para usar no Asaas (discount):</p>
                <pre className="text-xs text-neutral-300 overflow-auto">
                  {JSON.stringify(result.asaasDiscount, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {result && (
            <details className="mt-4">
              <summary className="text-xs text-neutral-500 cursor-pointer hover:text-neutral-400">
                Ver resposta completa da API
              </summary>
              <pre className="mt-2 p-3 bg-neutral-800 rounded text-xs text-neutral-400 overflow-auto max-h-60">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
