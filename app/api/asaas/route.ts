import { NextRequest, NextResponse } from 'next/server'

// =====================================================
// API Asaas - AMBIENTE DE PRODUCAO
// URL fixa: https://api.asaas.com/v3
// NUNCA usar sandbox neste sistema
// =====================================================
const ASAAS_BASE_URL = 'https://api.asaas.com/v3'
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjBhZWFlNDA0LTM2M2YtNDNkYi04MjM5LTA1NTk1NzRhNTllNjo6JGFhY2hfZGVhZmY0OTEtNjc3OC00MTQ0LTg5OTItOTliMDFmNzczMzEx'
const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || 'ad3b1fb7-eda4-48b0-abb1-cd77a8ad3de6'

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  // Garantir que o path comece com / e nao tenha duplicacao
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

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))

  const result = await asaasRequest('PUT', endpoint, body)

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
