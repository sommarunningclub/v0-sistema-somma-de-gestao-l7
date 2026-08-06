import { NextRequest, NextResponse } from 'next/server'
import {
  areAsaasQueryParamsAllowed,
  isAsaasEndpointAllowed,
  normalizeAsaasEndpoint,
} from '@/lib/asaas/proxy-policy'
import { asaasRequest, getAsaasConfig } from '@/lib/asaas/request'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function missingApiKeyResponse() {
  return NextResponse.json(
    {
      error: 'ASAAS_API_KEY not configured',
      message:
        'A chave API do Asaas não está configurada. Configure a variável de ambiente ASAAS_API_KEY com o valor da sua chave.',
      hint: 'Adicione ASAAS_API_KEY nas variáveis de ambiente do projeto.',
    },
    { status: 500 }
  )
}

function forbiddenEndpointResponse(method: string, endpoint: string) {
  return NextResponse.json(
    {
      error: 'Endpoint não permitido',
      message: `A operação ${method} ${normalizeAsaasEndpoint(endpoint)} não está autorizada neste proxy.`,
    },
    { status: 403 }
  )
}

function extractQueryParams(searchParams: URLSearchParams): Record<string, string> {
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      params[key] = value
    }
  })
  return params
}

async function handleAsaasProxy(
  request: NextRequest,
  method: string
): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint')
  const config = getAsaasConfig()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  if (!config.apiKey) {
    return missingApiKeyResponse()
  }

  if (!isAsaasEndpointAllowed(method, endpoint)) {
    return forbiddenEndpointResponse(method, endpoint)
  }

  const params = extractQueryParams(searchParams)
  if (method === 'GET' && Object.keys(params).length > 0 && !areAsaasQueryParamsAllowed(params)) {
    return NextResponse.json({ error: 'Parâmetros de consulta não permitidos' }, { status: 403 })
  }

  const path = normalizeAsaasEndpoint(endpoint)
  const body =
    method === 'POST' || method === 'PUT'
      ? await request.json().catch(() => ({}))
      : undefined

  const result = await asaasRequest(
    method,
    path,
    body as Record<string, unknown> | undefined,
    method === 'GET' && Object.keys(params).length > 0 ? params : undefined
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.data }, { status: result.status })
  }

  return NextResponse.json(result.data)
}

export async function GET(request: NextRequest) {
  return handleAsaasProxy(request, 'GET')
}

export async function POST(request: NextRequest) {
  return handleAsaasProxy(request, 'POST')
}

export async function PUT(request: NextRequest) {
  return handleAsaasProxy(request, 'PUT')
}

export async function DELETE(request: NextRequest) {
  return handleAsaasProxy(request, 'DELETE')
}
