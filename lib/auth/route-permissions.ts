import type { PermissionKey } from './types'

/** Rotas públicas — sem sessão necessária */
export const PUBLIC_API_ROUTES: Array<{ method?: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/ },
  { pattern: /^\/api\/webhooks\// },
  { pattern: /^\/api\/checkout\/validate-coupon/ },
  { pattern: /^\/api\/cron\// },
  { pattern: /^\/api\/eventos\/ativos$/ },
]

export function isPublicApiRoute(pathname: string, method: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => {
    if (route.method && route.method !== method) return false
    return route.pattern.test(pathname)
  })
}

/** Permissão exigida por prefixo de rota (admin sempre bypassa no middleware) */
const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; permission: PermissionKey }> = [
  { pattern: /^\/api\/admin\//, permission: 'admin' },
  { pattern: /^\/api\/checkin/, permission: 'checkin' },
  { pattern: /^\/api\/escala/, permission: 'escala' },
  { pattern: /^\/api\/asaas/, permission: 'pagamentos' },
  { pattern: /^\/api\/clicksign/, permission: 'pagamentos' },
  { pattern: /^\/api\/crm/, permission: 'crm' },
  { pattern: /^\/api\/tarefas/, permission: 'tarefas' },
  { pattern: /^\/api\/popups/, permission: 'popups' },
  { pattern: /^\/api\/partners/, permission: 'parceiro' },
  { pattern: /^\/api\/partner-codes/, permission: 'parceiro' },
  { pattern: /^\/api\/insider/, permission: 'pagamentos' },
  { pattern: /^\/api\/coupons/, permission: 'pagamentos' },
  { pattern: /^\/api\/payments/, permission: 'pagamentos' },
]

export function getRequiredPermission(pathname: string): PermissionKey | null {
  for (const entry of ROUTE_PERMISSIONS) {
    if (entry.pattern.test(pathname)) return entry.permission
  }
  // Rotas autenticadas sem permissão específica (ex: /api/cnpj, /api/auth/me)
  return null
}
