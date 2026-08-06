type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface AllowedRoute {
  pattern: RegExp
  methods: HttpMethod[]
}

/**
 * Clicksign ainda não é usado pelo frontend.
 * Mantemos apenas diagnóstico até integrações serem implementadas.
 */
const CLICKSIGN_ALLOWED_ROUTES: AllowedRoute[] = [
  { pattern: /^\/diagnostico$/, methods: ['GET'] },
]

export function normalizeClicksignEndpoint(endpoint: string): string {
  const path = endpoint.split('?')[0].trim()
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

export function isClicksignEndpointAllowed(method: string, endpoint: string): boolean {
  const path = normalizeClicksignEndpoint(endpoint)
  if (!path || path.includes('..') || path.includes('//')) return false

  return CLICKSIGN_ALLOWED_ROUTES.some(
    (route) => route.pattern.test(path) && route.methods.includes(method as HttpMethod)
  )
}
