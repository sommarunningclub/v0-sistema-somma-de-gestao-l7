const ASAAS_BASE_URL = 'https://api.asaas.com/v3'

export function getAsaasConfig() {
  const apiKey = (process.env.ASAAS_API_KEY || '').trim()
  const walletId = (process.env.ASAAS_WALLET_ID || '').trim()

  if (!apiKey && process.env.NODE_ENV === 'production') {
    console.error('[v0] ASAAS_API_KEY is not configured in production!')
  }

  return { apiKey, walletId, baseUrl: ASAAS_BASE_URL }
}

export async function asaasRequest(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
) {
  const config = getAsaasConfig()

  if (!config.apiKey) {
    throw new Error('ASAAS_API_KEY not configured')
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${config.baseUrl}${cleanPath}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      access_token: config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
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
