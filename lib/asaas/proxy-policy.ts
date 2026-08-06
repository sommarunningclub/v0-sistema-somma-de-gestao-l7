type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface AllowedRoute {
  pattern: RegExp
  methods: HttpMethod[]
}

/** Endpoints Asaas permitidos via proxy — alinhados ao uso real do sistema */
const ASAAS_ALLOWED_ROUTES: AllowedRoute[] = [
  { pattern: /^\/customers$/, methods: ['GET', 'POST'] },
  { pattern: /^\/customers\/[A-Za-z0-9_]+$/, methods: ['GET', 'PUT', 'DELETE'] },
  { pattern: /^\/payments$/, methods: ['GET', 'POST'] },
  { pattern: /^\/payments\/[A-Za-z0-9_]+$/, methods: ['GET', 'DELETE'] },
  { pattern: /^\/payments\/[A-Za-z0-9_]+\/refund$/, methods: ['POST'] },
  { pattern: /^\/subscriptions$/, methods: ['GET', 'POST'] },
  { pattern: /^\/subscriptions\/[A-Za-z0-9_]+$/, methods: ['GET'] },
]

const ALLOWED_QUERY_PARAMS = new Set([
  'limit',
  'offset',
  'customer',
  'status',
  'name',
  'cpfCnpj',
  'subscription',
  'dateCreated[ge]',
  'dateCreated[le]',
])

export function normalizeAsaasEndpoint(endpoint: string): string {
  const path = endpoint.split('?')[0].trim()
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

export function isAsaasEndpointAllowed(method: string, endpoint: string): boolean {
  const path = normalizeAsaasEndpoint(endpoint)
  if (!path || path.includes('..') || path.includes('//')) return false

  return ASAAS_ALLOWED_ROUTES.some(
    (route) => route.pattern.test(path) && route.methods.includes(method as HttpMethod)
  )
}

export function areAsaasQueryParamsAllowed(params: Record<string, string>): boolean {
  return Object.keys(params).every((key) => ALLOWED_QUERY_PARAMS.has(key))
}
