import { NextRequest, NextResponse } from 'next/server'

// =====================================================
// API Asaas - Proxy para comunicação com a API
// Documentação oficial: https://docs.asaas.com
// =====================================================

function getAsaasConfig() {
  const config = {
    baseUrl: process.env.NEXT_PUBLIC_ASAAS_API_URL || '',
    apiKey: process.env.ASAAS_API_KEY || '',
    walletId: process.env.ASAAS_WALLET_ID || ''
  }
  
  if (!config.baseUrl || !config.apiKey) {
    console.error('[Asaas Route] Configuração incompleta:', {
      hasBaseUrl: !!config.baseUrl,
      hasApiKey: !!config.apiKey,
      baseUrl: config.baseUrl ? 'configurado' : 'FALTANDO',
      apiKey: config.apiKey ? 'configurado' : 'FALTANDO'
    })
  }
  
  return config
}

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const config = getAsaasConfig()
  
  if (!config.baseUrl || !config.apiKey) {
    return {
      ok: false,
      status: 500,
      data: { error: 'Asaas não configurado corretamente' }
    }
  }

  // Garantir que o path comece com / e não tenha duplicação
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${config.baseUrl}${cleanPath}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  console.log('[Asaas Route] Request:', method, url.toString())

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
  
  console.log('[Asaas Route] Response:', response.status, response.ok ? 'OK' : 'ERROR')
  
  return {
    ok: response.ok,
    status: response.status,
    data,
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
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
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
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
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  const result = await asaasRequest('DELETE', endpoint)
  
  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
