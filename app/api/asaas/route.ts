import { NextRequest, NextResponse } from 'next/server'

// Asaas API Proxy - v2.2.0 - Rebuild forced
// Producao: https://api.asaas.com/v3
const ASAAS_URL = 'https://api.asaas.com/v3'
const ASAAS_KEY = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjBhZWFlNDA0LTM2M2YtNDNkYi04MjM5LTA1NTk1NzRhNTllNjo6JGFhY2hfZGVhZmY0OTEtNjc3OC00MTQ0LTg5OTItOTliMDFmNzczMzEx'

async function callAsaas(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const key = process.env.ASAAS_API_KEY || ASAAS_KEY
  const base = process.env.NEXT_PUBLIC_ASAAS_API_URL || ASAAS_URL
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${base}${cleanPath}`)

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v))
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'access_token': key,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
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

  const result = await callAsaas('GET', endpoint, undefined, Object.keys(params).length > 0 ? params : undefined)

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
  const result = await callAsaas('POST', endpoint, body)

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
  const result = await callAsaas('PUT', endpoint, body)

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

  const result = await callAsaas('DELETE', endpoint)

  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}
