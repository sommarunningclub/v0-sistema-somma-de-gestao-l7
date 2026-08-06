import { NextRequest, NextResponse } from 'next/server'
import {
  isClicksignEndpointAllowed,
  normalizeClicksignEndpoint,
} from '@/lib/clicksign/proxy-policy'

function getClicksignConfig() {
  const accessToken = (process.env.CLICKSIGN_ACCESS_TOKEN || '').trim()
  const baseUrl = (process.env.CLICKSIGN_BASE_URL || 'https://sandbox.clicksign.com').replace(
    /\/$/,
    ''
  )

  if (!accessToken) {
    console.error('[v0] CLICKSIGN_ACCESS_TOKEN not set!')
  }

  return { accessToken, baseUrl }
}

async function callClicksign(
  baseUrl: string,
  accessToken: string,
  endpoint: string,
  method: string,
  body?: unknown
) {
  const separator = endpoint.includes('?') ? '&' : '?'
  const url = `${baseUrl}/api/v3${endpoint}${separator}access_token=${accessToken}`

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    },
  }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (response.status === 204) {
    return { ok: true, status: 204, data: { success: true } }
  }

  let data: unknown
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json')) {
    data = await response.json()
  } else {
    const text = await response.text()
    data = { raw: text }
  }

  return { ok: response.ok, status: response.status, data }
}

function forbiddenEndpointResponse(method: string, endpoint: string) {
  return NextResponse.json(
    {
      error: 'Endpoint não permitido',
      message: `A operação ${method} ${normalizeClicksignEndpoint(endpoint)} não está autorizada neste proxy.`,
    },
    { status: 403 }
  )
}

async function handleClicksignProxy(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const config = getClicksignConfig()

  if (!config.accessToken) {
    return NextResponse.json(
      {
        error: 'CLICKSIGN_ACCESS_TOKEN não configurado.',
        hint: 'Configure a variável CLICKSIGN_ACCESS_TOKEN nas variáveis de ambiente da Vercel.',
        baseUrl: config.baseUrl,
      },
      { status: 500 }
    )
  }

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 })
  }

  if (!isClicksignEndpointAllowed(method, endpoint)) {
    return forbiddenEndpointResponse(method, endpoint)
  }

  if (endpoint === '/diagnostico') {
    return NextResponse.json({
      ok: true,
      tokenConfigured: true,
      baseUrl: config.baseUrl,
    })
  }

  try {
    const body =
      method === 'POST' || method === 'PATCH'
        ? await request.json().catch(() => ({}))
        : undefined
    const result = await callClicksign(
      config.baseUrl,
      config.accessToken,
      endpoint,
      method,
      body
    )
    if (!result.ok) {
      return NextResponse.json(
        { error: 'Erro na API Clicksign', details: result.data },
        { status: result.status }
      )
    }
    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error('[v0] Clicksign proxy error:', message)
    return NextResponse.json(
      { error: 'Erro ao conectar com Clicksign', details: message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleClicksignProxy(request, 'GET')
}

export async function POST(request: NextRequest) {
  return handleClicksignProxy(request, 'POST')
}

export async function PATCH(request: NextRequest) {
  return handleClicksignProxy(request, 'PATCH')
}

export async function DELETE(request: NextRequest) {
  return handleClicksignProxy(request, 'DELETE')
}
