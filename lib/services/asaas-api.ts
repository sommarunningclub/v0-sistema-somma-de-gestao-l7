// =====================================================
// Servico de API para comunicacao com o Asaas
// Documentação oficial: https://docs.asaas.com
// =====================================================

// Configurações da API Asaas
// Você pode usar ambiente de produção ou sandbox
// Produção: https://api.asaas.com/v3
// Sandbox: https://sandbox.asaas.com/api/v3

// Função para obter configurações (lazy evaluation para evitar warnings prematuros)
function getAsaasConfig() {
  return {
    apiUrl: process.env.NEXT_PUBLIC_ASAAS_API_URL || '',
    apiKey: process.env.ASAAS_API_KEY || '',
    walletId: process.env.ASAAS_WALLET_ID || ''
  }
}

export const ASAAS_WALLET_ID = process.env.ASAAS_WALLET_ID || ''

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
    const config = getAsaasConfig()
    
    if (!config.apiUrl || !config.apiKey) {
      return { data: null, error: 'Asaas não configurado corretamente' }
    }

    const url = new URL(`${config.apiUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        'access_token': config.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
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
