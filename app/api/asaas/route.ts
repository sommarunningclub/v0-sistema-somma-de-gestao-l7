import { NextRequest, NextResponse } from 'next/server'

// =====================================================
// API Asaas - Proxy para comunicação com a API
// Documentação oficial: https://docs.asaas.com
// =====================================================
const ASAAS_BASE_URL = process.env.NEXT_PUBLIC_ASAAS_API_URL || ''
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || ''
const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || ''

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  // Garantir que o path comece com / e não tenha duplicação
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${ASAAS_BASE_URL}${cleanPath}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      'access_token': ASAAS_API_KEY,
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
  
  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'ASAAS_API_KEY not configured' }, { status: 500 })
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

  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'ASAAS_API_KEY not configured' }, { status: 500 })
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

  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'ASAAS_API_KEY not configured' }, { status: 500 })
  }

  const result = await asaasRequest('DELETE', endpoint)
  
  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
