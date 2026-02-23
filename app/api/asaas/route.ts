import { NextRequest, NextResponse } from 'next/server'

// Force dynamic rendering to always read fresh environment variables
export const dynamic = 'force-dynamic'
export const revalidate = 0

// =====================================================
// API Asaas - AMBIENTE DE PRODUÇÃO
// URL fixa: https://api.asaas.com/v3
// NUNCA usar sandbox neste sistema
// =====================================================
const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

// Helper function to get fresh env vars on each request
function getAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY || ''
  const walletId = process.env.ASAAS_WALLET_ID || ''
  
  // Debug log para entender o problema no sandbox
  if (!apiKey) {
    console.error('[v0] ASAAS_API_KEY is not configured! Current value:', apiKey)
    console.error('[v0] Available env vars:', Object.keys(process.env).filter(k => k.includes('ASAAS')))
  }
  
  return {
    apiKey,
    walletId,
    baseUrl: 'https://api.asaas.com/v3'
  }
}

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const config = getAsaasConfig()

  if (!config.apiKey) {
    console.error('[v0] ASAAS_API_KEY not available in request')
    throw new Error('ASAAS_API_KEY not configured')
  }

  // Garantir que o path comece com / e não tenha duplicação
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${config.baseUrl}${cleanPath}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  console.log('[v0] Making Asaas request:', method, cleanPath, 'API Key length:', config.apiKey.length)

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'access_token': config.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json().catch(() => null)

  return {
    ok: response.ok,
    status: response.status,
    data,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const config = getAsaasConfig()

  console.log('[v0] GET /api/asaas called, endpoint:', endpoint, 'ASAAS_API_KEY available:', !!config.apiKey, 'Length:', config.apiKey.length)

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  if (!config.apiKey) {
    return NextResponse.json({ 
      error: 'ASAAS_API_KEY not configured',
      message: 'A chave API do Asaas não está configurada. Em produção, configure a variável de ambiente ASAAS_API_KEY.'
    }, { status: 500 })
  }

  // Converter searchParams para objeto, excluindo 'endpoint'
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      params[key] = value
    }
  })

  const result = await asaasRequest('GET', endpoint, undefined, Object.keys(params).length > 0 ? params : undefined)

  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const config = getAsaasConfig()

  console.log('[v0] POST /api/asaas called, endpoint:', endpoint, 'ASAAS_API_KEY available:', !!config.apiKey, 'Length:', config.apiKey.length)

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  if (!config.apiKey) {
    return NextResponse.json({ 
      error: 'ASAAS_API_KEY not configured',
      message: 'A chave API do Asaas não está configurada. Em produção, configure a variável de ambiente ASAAS_API_KEY.'
    }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))

  const result = await asaasRequest('POST', endpoint, body)

  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const config = getAsaasConfig()

  console.log('[v0] DELETE /api/asaas called, endpoint:', endpoint, 'ASAAS_API_KEY available:', !!config.apiKey, 'Length:', config.apiKey.length)

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  if (!config.apiKey) {
    return NextResponse.json({ 
      error: 'ASAAS_API_KEY not configured',
      message: 'A chave API do Asaas não está configurada. Em produção, configure a variável de ambiente ASAAS_API_KEY.'
    }, { status: 500 })
  }

  const result = await asaasRequest('DELETE', endpoint)

  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
