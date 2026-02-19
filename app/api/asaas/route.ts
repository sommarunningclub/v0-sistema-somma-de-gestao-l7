import { NextRequest, NextResponse } from 'next/server'

// =====================================================
// API Asaas - Proxy para comunicacao com a API
// Documentacao: https://docs.asaas.com
// =====================================================

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

function getApiKey(): string {
  // Tenta ler da env var primeiro
  const envKey = process.env.ASAAS_API_KEY
  if (envKey && envKey.length > 10) {
    return envKey
  }
  // Fallback: chave configurada diretamente
  return '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjBhZWFlNDA0LTM2M2YtNDNkYi04MjM5LTA1NTk1NzRhNTllNjo6JGFhY2hfZGVhZmY0OTEtNjc3OC00MTQ0LTg5OTItOTliMDFmNzczMzEx'
}

async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const apiKey = getApiKey()
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
      'access_token': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
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
