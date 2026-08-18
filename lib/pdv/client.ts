import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/api-auth'
import { joinPosUrl } from '@/lib/pdv/types'

function posApiUrl(): string {
  return (process.env.POS_API_URL || 'https://somma-pdv-point.vercel.app').replace(/\/$/, '')
}

function posInternalKey(): string {
  const key = process.env.POS_INTERNAL_API_KEY
  if (!key || key.length < 32) {
    throw new Error('POS_INTERNAL_API_KEY ausente ou curto demais (mínimo 32 caracteres)')
  }
  return key
}

export function joinPosPath(path: string): string {
  return joinPosUrl(posApiUrl(), path)
}

/**
 * Proxy autenticado do painel para o PDV.
 * O browser nunca vê a API key e nunca fala com Mercado Pago/Shopify.
 */
export async function proxyToPos(
  request: NextRequest,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<NextResponse> {
  const auth = await requirePermission(request, 'pdv')
  if (auth instanceof NextResponse) return auth

  let key: string
  try {
    key = posInternalKey()
  } catch {
    return NextResponse.json(
      {
        error:
          'O módulo PDV ainda não está configurado neste ambiente. Defina POS_API_URL e POS_INTERNAL_API_KEY.',
      },
      { status: 503 },
    )
  }

  const url = new URL(joinPosPath(path))
  request.nextUrl.searchParams.forEach((value, name) => {
    url.searchParams.set(name, value)
  })

  const method = (init?.method ?? request.method).toUpperCase()
  const hasJsonBody = init?.body !== undefined
  const shouldForwardBody = hasJsonBody || (method !== 'GET' && method !== 'HEAD')

  try {
    const upstream = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        ...(shouldForwardBody ? { 'Content-Type': 'application/json' } : {}),
      },
      body: hasJsonBody
        ? JSON.stringify(init.body)
        : shouldForwardBody
          ? await request.text()
          : undefined,
      cache: 'no-store',
    })

    const text = await upstream.text()
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (err) {
    console.error('[pdv] Falha ao conectar no PDV:', err)
    return NextResponse.json(
      { error: 'Não foi possível conectar ao PDV. Confira POS_API_URL.' },
      { status: 502 },
    )
  }
}
