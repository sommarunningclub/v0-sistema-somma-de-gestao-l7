// =====================================================
// Servico de API para comunicacao com o Asaas
// Documentacao: https://docs.asaas.com
// =====================================================

const ASAAS_BASE_URL = 'https://api.asaas.com/v3'
const FALLBACK_API_KEY = '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjBhZWFlNDA0LTM2M2YtNDNkYi04MjM5LTA1NTk1NzRhNTllNjo6JGFhY2hfZGVhZmY0OTEtNjc3OC00MTQ0LTg5OTItOTliMDFmNzczMzEx'
const FALLBACK_WALLET_ID = 'ad3b1fb7-eda4-48b0-abb1-cd77a8ad3de6'

function getApiKey(): string {
  const envKey = process.env.ASAAS_API_KEY
  return (envKey && envKey.length > 10) ? envKey : FALLBACK_API_KEY
}

function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_ASAAS_API_URL
  return (envUrl && envUrl.length > 10) ? envUrl : ASAAS_BASE_URL
}

export const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || FALLBACK_WALLET_ID

interface ApiResponse<T> {
  data: T | null
  error: string | null
}

async function asaasRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
  params?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const apiUrl = getApiUrl()
    const apiKey = getApiKey()

    const url = new URL(`${apiUrl}${path}`)
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

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[v0] Asaas API error:', response.status, errorText)
      return { data: null, error: errorText }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (err) {
    console.error('[v0] Asaas request failed:', err)
    return { data: null, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// Clientes
export async function listClients(params?: { name?: string; cpfCnpj?: string; offset?: number; limit?: number }) {
  const queryParams: Record<string, string> = {}
  if (params?.name) queryParams.name = params.name
  if (params?.cpfCnpj) queryParams.cpfCnpj = params.cpfCnpj
  if (params?.offset !== undefined) queryParams.offset = String(params.offset)
  if (params?.limit !== undefined) queryParams.limit = String(params.limit)
  
  return asaasRequest<{ data: unknown[]; hasMore: boolean; totalCount: number }>('GET', '/customers', undefined, queryParams)
}

export async function createClient(payload: {
  name: string
  cpfCnpj: string
  email?: string
  mobilePhone?: string
  phone?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  complement?: string
  province?: string
  city?: string
  state?: string
}) {
  return asaasRequest<unknown>('POST', '/customers', payload)
}

export async function getClient(customerId: string) {
  return asaasRequest<unknown>('GET', `/customers/${customerId}`)
}

// Cobranças
export async function listCharges(params?: { status?: string; customer?: string; offset?: number; limit?: number }) {
  const queryParams: Record<string, string> = {}
  if (params?.status) queryParams.status = params.status
  if (params?.customer) queryParams.customer = params.customer
  if (params?.offset !== undefined) queryParams.offset = String(params.offset)
  if (params?.limit !== undefined) queryParams.limit = String(params.limit)
  
  return asaasRequest<{ data: unknown[]; hasMore: boolean; totalCount: number }>('GET', '/payments', undefined, queryParams)
}

export async function createCharge(payload: {
  customer: string
  value: number
  dueDate: string
  billingType: string
  description?: string
  externalReference?: string
  fine?: { value: number }
  interest?: { value: number }
  discount?: { value: number; dueDateLimitDays?: number }
}) {
  return asaasRequest<unknown>('POST', '/payments', payload)
}

export async function getCharge(paymentId: string) {
  return asaasRequest<unknown>('GET', `/payments/${paymentId}`)
}

export async function getChargeViewingInfo(paymentId: string) {
  return asaasRequest<{
    hasBeenViewed: boolean
    viewedDate: string | null
    viewCount: number
  }>('GET', `/payments/${paymentId}/viewingInfo`)
}

// Assinaturas
export async function listSubscriptions(params?: { status?: string; customer?: string; offset?: number; limit?: number }) {
  const queryParams: Record<string, string> = {}
  if (params?.status) queryParams.status = params.status
  if (params?.customer) queryParams.customer = params.customer
  if (params?.offset !== undefined) queryParams.offset = String(params.offset)
  if (params?.limit !== undefined) queryParams.limit = String(params.limit)
  
  return asaasRequest<{ data: unknown[]; hasMore: boolean; totalCount: number }>('GET', '/subscriptions', undefined, queryParams)
}

export async function createSubscription(payload: {
  customer: string
  value: number
  nextDueDate: string
  cycle: string
  description?: string
  billingType?: string
  fine?: { value: number }
  interest?: { value: number }
  discount?: { value: number; dueDateLimitDays?: number }
}) {
  return asaasRequest<unknown>('POST', '/subscriptions', payload)
}

export async function getSubscription(subscriptionId: string) {
  return asaasRequest<unknown>('GET', `/subscriptions/${subscriptionId}`)
}

export async function getSubscriptionPayments(subscriptionId: string) {
  return asaasRequest<{ data: unknown[]; hasMore: boolean; totalCount: number }>('GET', '/payments', undefined, { subscription: subscriptionId, limit: '20' })
}

// Dashboard
export async function getDashboardMetrics(month: string) {
  return asaasRequest<{
    month: string
    received: number
    awaiting: number
    overdue: number
    mrr: number
    activeSubscriptions: number
    churnRate: number
  }>('GET', '/dashboard/payments', undefined, { month })
}
