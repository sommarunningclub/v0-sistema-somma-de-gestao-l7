import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Força a leitura das variáveis de ambiente atualizadas
  const apiKey = process.env.ASAAS_API_KEY || ''
  const walletId = process.env.ASAAS_WALLET_ID || ''
  const baseUrl = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3'
  
  console.log('='.repeat(80))
  console.log('[v0] ASAAS ENVIRONMENT CHECK - REFRESH ENDPOINT')
  console.log('='.repeat(80))
  console.log('[v0] Timestamp:', new Date().toISOString())
  console.log('[v0] ASAAS_API_KEY exists:', !!apiKey)
  console.log('[v0] ASAAS_API_KEY length:', apiKey.length)
  console.log('[v0] ASAAS_API_KEY first 20 chars:', apiKey.substring(0, 20) + '...')
  console.log('[v0] ASAAS_WALLET_ID exists:', !!walletId)
  console.log('[v0] ASAAS_WALLET_ID:', walletId)
  console.log('[v0] ASAAS_BASE_URL:', baseUrl)
  console.log('='.repeat(80))

  if (!apiKey || apiKey.length < 50) {
    return NextResponse.json({
      success: false,
      error: 'ASAAS_API_KEY not properly configured',
      message: 'The API key is missing or too short. Please verify it in Vercel environment variables.',
      debug: {
        apiKeyExists: !!apiKey,
        apiKeyLength: apiKey.length,
        walletIdExists: !!walletId,
        walletId: walletId,
        baseUrl: baseUrl,
        timestamp: new Date().toISOString(),
      }
    }, { status: 500 })
  }

  // Testa a conexão com o Asaas
  try {
    console.log('[v0] Testing Asaas API connection...')
    const response = await fetch(`${baseUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[v0] Asaas API test failed:', response.status, data)
      return NextResponse.json({
        success: false,
        error: 'Asaas API authentication failed',
        status: response.status,
        details: data,
        debug: {
          apiKeyExists: true,
          apiKeyLength: apiKey.length,
          apiKeyPreview: apiKey.substring(0, 20) + '...',
          walletIdExists: !!walletId,
          walletId: walletId,
          baseUrl: baseUrl,
          timestamp: new Date().toISOString(),
        }
      }, { status: response.status })
    }

    console.log('[v0] Asaas API connection successful!')
    console.log('[v0] Total customers:', data.totalCount || 0)
    console.log('='.repeat(80))

    return NextResponse.json({
      success: true,
      message: 'Asaas API is properly configured and working!',
      data: {
        totalCustomers: data.totalCount || 0,
        apiConnected: true,
        timestamp: new Date().toISOString(),
      },
      config: {
        apiKeyConfigured: true,
        apiKeyLength: apiKey.length,
        walletIdConfigured: !!walletId,
        walletId: walletId,
        baseUrl: baseUrl,
      }
    })
  } catch (error) {
    console.error('[v0] Error testing Asaas API:', error)
    console.log('='.repeat(80))
    return NextResponse.json({
      success: false,
      error: 'Exception during Asaas API test',
      details: error instanceof Error ? error.message : String(error),
      debug: {
        apiKeyExists: true,
        apiKeyLength: apiKey.length,
        walletIdExists: !!walletId,
        walletId: walletId,
        baseUrl: baseUrl,
        timestamp: new Date().toISOString(),
      }
    }, { status: 500 })
  }
}
