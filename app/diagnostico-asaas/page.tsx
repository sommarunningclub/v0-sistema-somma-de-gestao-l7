'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react'

interface TestResult {
  name: string
  status: 'success' | 'error' | 'pending'
  message: string
  details?: any
}

export default function DiagnosticoAsaasPage() {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])

  const runTests = async () => {
    setTesting(true)
    setResults([])
    const testResults: TestResult[] = []

    // Test 1: API Key Configuration
    try {
      testResults.push({ name: 'Configuração da API Key', status: 'pending', message: 'Testando...' })
      setResults([...testResults])

      const response = await fetch('/api/asaas/test')
      const data = await response.json()

      if (data.success) {
        testResults[testResults.length - 1] = {
          name: 'Configuração da API Key',
          status: 'success',
          message: 'API Key configurada e válida',
          details: data,
        }
      } else {
        testResults[testResults.length - 1] = {
          name: 'Configuração da API Key',
          status: 'error',
          message: data.error || 'Erro desconhecido',
          details: data,
        }
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'Configuração da API Key',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro ao testar',
      }
    }
    setResults([...testResults])

    // Test 2: Listar Clientes
    try {
      testResults.push({ name: 'GET /customers', status: 'pending', message: 'Testando...' })
      setResults([...testResults])

      const response = await fetch('/api/asaas?endpoint=/customers&limit=5')
      const data = await response.json()

      if (response.ok && data.data) {
        testResults[testResults.length - 1] = {
          name: 'GET /customers',
          status: 'success',
          message: `${data.totalCount || 0} clientes encontrados`,
          details: data,
        }
      } else {
        testResults[testResults.length - 1] = {
          name: 'GET /customers',
          status: 'error',
          message: data.error || 'Erro ao buscar clientes',
          details: data,
        }
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'GET /customers',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro ao testar',
      }
    }
    setResults([...testResults])

    // Test 3: Listar Assinaturas
    try {
      testResults.push({ name: 'GET /subscriptions', status: 'pending', message: 'Testando...' })
      setResults([...testResults])

      const response = await fetch('/api/asaas?endpoint=/subscriptions&limit=5')
      const data = await response.json()

      if (response.ok && data.data) {
        testResults[testResults.length - 1] = {
          name: 'GET /subscriptions',
          status: 'success',
          message: `${data.totalCount || 0} assinaturas encontradas`,
          details: data,
        }
      } else {
        testResults[testResults.length - 1] = {
          name: 'GET /subscriptions',
          status: 'error',
          message: data.error || 'Erro ao buscar assinaturas',
          details: data,
        }
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'GET /subscriptions',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro ao testar',
      }
    }
    setResults([...testResults])

    // Test 4: Listar Pagamentos
    try {
      testResults.push({ name: 'GET /payments', status: 'pending', message: 'Testando...' })
      setResults([...testResults])

      const response = await fetch('/api/asaas?endpoint=/payments&limit=5')
      const data = await response.json()

      if (response.ok && data.data) {
        testResults[testResults.length - 1] = {
          name: 'GET /payments',
          status: 'success',
          message: `${data.totalCount || 0} pagamentos encontrados`,
          details: data,
        }
      } else {
        testResults[testResults.length - 1] = {
          name: 'GET /payments',
          status: 'error',
          message: data.error || 'Erro ao buscar pagamentos',
          details: data,
        }
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'GET /payments',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro ao testar',
      }
    }
    setResults([...testResults])

    // Test 5: Buscar Assinaturas Ativas
    try {
      testResults.push({ name: 'GET /subscriptions?status=ACTIVE', status: 'pending', message: 'Testando...' })
      setResults([...testResults])

      const response = await fetch('/api/asaas?endpoint=/subscriptions&status=ACTIVE&limit=100')
      const data = await response.json()

      if (response.ok && data.data) {
        testResults[testResults.length - 1] = {
          name: 'GET /subscriptions?status=ACTIVE',
          status: 'success',
          message: `${data.data.length || 0} assinaturas ativas`,
          details: data,
        }
      } else {
        testResults[testResults.length - 1] = {
          name: 'GET /subscriptions?status=ACTIVE',
          status: 'error',
          message: data.error || 'Erro ao buscar assinaturas ativas',
          details: data,
        }
      }
    } catch (error) {
      testResults[testResults.length - 1] = {
        name: 'GET /subscriptions?status=ACTIVE',
        status: 'error',
        message: error instanceof Error ? error.message : 'Erro ao testar',
      }
    }
    setResults([...testResults])

    setTesting(false)
  }

  const successCount = results.filter(r => r.status === 'success').length
  const errorCount = results.filter(r => r.status === 'error').length

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Diagnóstico Asaas API</h1>
          <p className="text-neutral-400">Teste de conectividade e validação das rotas da API Asaas</p>
        </div>

        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white">Executar Testes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={runTests}
              disabled={testing}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              {testing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executando Testes...
                </>
              ) : (
                'Executar Todos os Testes'
              )}
            </Button>

            {results.length > 0 && (
              <div className="flex gap-4 p-4 bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-white font-medium">{successCount} Sucesso</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <span className="text-white font-medium">{errorCount} Erro</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {results.map((result, index) => (
          <Card key={index} className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {result.status === 'success' && <CheckCircle className="w-6 h-6 text-green-500" />}
                  {result.status === 'error' && <XCircle className="w-6 h-6 text-red-500" />}
                  {result.status === 'pending' && <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />}
                  <div>
                    <h3 className="text-white font-semibold">{result.name}</h3>
                    <p className="text-neutral-400 text-sm">{result.message}</p>
                  </div>
                </div>
                <Badge
                  className={
                    result.status === 'success'
                      ? 'bg-green-500/20 text-green-400'
                      : result.status === 'error'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }
                >
                  {result.status === 'success' ? 'OK' : result.status === 'error' ? 'ERRO' : 'TESTANDO'}
                </Badge>
              </div>

              {result.details && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-neutral-400 hover:text-white">
                    Ver detalhes
                  </summary>
                  <pre className="mt-2 p-4 bg-neutral-800 rounded text-xs text-neutral-300 overflow-auto max-h-64">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        ))}

        {results.length === 0 && !testing && (
          <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <p className="text-neutral-400">Clique em "Executar Todos os Testes" para iniciar o diagnóstico</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
