import type { PermissionKey } from './types'

/** Rotas públicas — sem sessão necessária */
export const PUBLIC_API_ROUTES: Array<{ method?: string; pattern: RegExp }> = [
  { method: 'POST', pattern: /^\/api\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/auth\/logout$/ },
  { pattern: /^\/api\/webhooks\// },
  { pattern: /^\/api\/checkout\/validate-coupon/ },
  { pattern: /^\/api\/cron\// },
  { pattern: /^\/api\/eventos\/ativos$/ },
  // Página pública /insider (auto-cadastro do Insider)
  { method: 'POST', pattern: /^\/api\/insiders\/lookup$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/register$/ },
  { pattern: /^\/api\/unsubscribe$/ },
  // Portal do Insider — o middleware não gateia; cada rota valida o
  // cookie somma_insider_session dentro do próprio handler.
  { method: 'POST', pattern: /^\/api\/insiders\/entrar$/ },
  // Login por código enviado ao e-mail cadastrado: pedir e trocar o código
  // acontecem antes de existir sessão.
  { method: 'POST', pattern: /^\/api\/insiders\/codigo$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/entrar-codigo$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/criar-senha$/ },
  { method: 'POST', pattern: /^\/api\/insiders\/sair$/ },
  { pattern: /^\/api\/insiders\/eu(\/|$)/ },
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
  { pattern: /^\/api\/clicksign/, permission: 'pagamentos' },
  { pattern: /^\/api\/crm/, permission: 'crm' },
  { pattern: /^\/api\/tarefas/, permission: 'tarefas' },
  { pattern: /^\/api\/popups/, permission: 'popups' },
  { pattern: /^\/api\/email-/, permission: 'email' },
  { pattern: /^\/api\/partners/, permission: 'parceiro' },
  { pattern: /^\/api\/partner-codes/, permission: 'parceiro' },
  { pattern: /^\/api\/insider/, permission: 'pagamentos' },
  { pattern: /^\/api\/coupons/, permission: 'pagamentos' },
  { pattern: /^\/api\/pdv/, permission: 'pdv' },
  { pattern: /^\/api\/pix-automatico/, permission: 'pixAutomatico' },
  { pattern: /^\/api\/nps(\/|$)/, permission: 'nps' },
  // Defesa em profundidade: os handlers destas rotas já chamam
  // requirePermission; espelhar o prefixo aqui evita que uma rota nova no
  // mesmo módulo nasça sem checagem alguma.
  { pattern: /^\/api\/membros/, permission: 'membros' },
  { pattern: /^\/api\/vagas/, permission: 'vagas' },
  { pattern: /^\/api\/command-center/, permission: 'dashboard' },
  { pattern: /^\/api\/cnpj/, permission: 'parceiro' },
]

export function getRequiredPermission(pathname: string): PermissionKey | null {
  for (const entry of ROUTE_PERMISSIONS) {
    if (entry.pattern.test(pathname)) return entry.permission
  }
  // Rotas autenticadas sem permissão específica (ex: /api/auth/me)
  return null
}
