import type { PermissionKey } from './types'

export const SECTION_LABELS: Record<string, string> = {
  overview: 'Dashboard',
  checkin: 'Check-in',
  eventos: 'Eventos',
  escala: 'Escala',
  agents: 'Membros',
  parceiro: 'Parceiro Somma',
  insiders: 'Insiders',
  crm: 'CRM',
  tarefas: 'Tarefas',
  popups: 'Pop-ups',
  systems: 'Administração',
}

/** Mapeia section da SPA → permissão exigida */
export const SECTION_PERMISSIONS: Record<string, PermissionKey | null> = {
  overview: 'dashboard',
  checkin: 'checkin',
  eventos: 'checkin',
  escala: 'escala',
  agents: 'membros',
  parceiro: 'parceiro',
  insiders: 'pagamentos',
  crm: 'crm',
  tarefas: 'tarefas',
  popups: 'popups',
  systems: 'admin',
}

/** Rotas legadas → redirect para SPA */
const LEGACY_EXACT: Record<string, string> = {
  '/': '/',
  '/crm': '/?section=crm',
  '/checkin': '/?section=checkin',
  '/eventos': '/?section=eventos',
  '/escala': '/?section=escala',
  '/agent-network': '/?section=agents',
  '/parceiro': '/?section=parceiro',
  '/tarefas': '/?section=tarefas',
  '/insiders': '/?section=insiders',
  '/popups': '/?section=popups',
  '/systems': '/?section=systems',
  '/command-center': '/?section=overview',
  '/operations': '/?section=overview',
}

const PAGE_PERMISSIONS: Array<{ pattern: RegExp; permission: PermissionKey }> = [
  { pattern: /^\/systems$/, permission: 'admin' },
  { pattern: /^\/checkin/, permission: 'checkin' },
  { pattern: /^\/eventos/, permission: 'checkin' },
  { pattern: /^\/escala/, permission: 'escala' },
  { pattern: /^\/agent-network/, permission: 'membros' },
  { pattern: /^\/parceiro/, permission: 'parceiro' },
  { pattern: /^\/crm/, permission: 'crm' },
  { pattern: /^\/tarefas/, permission: 'tarefas' },
  { pattern: /^\/popups/, permission: 'popups' },
  { pattern: /^\/insiders/, permission: 'pagamentos' },
]

export function isPublicPage(pathname: string): boolean {
  return pathname === '/login'
}

export function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?|json)$/i.test(pathname)) return true
  return false
}

export function getSpaRedirect(pathname: string, search: string): string | null {
  if (LEGACY_EXACT[pathname]) {
    const base = LEGACY_EXACT[pathname]
    if (base === '/') return null
    return mergeQuery(base, search)
  }


  // Analytics permanece como rota standalone autenticada
  if (/^\/popups\/[^/]+\/analytics$/.test(pathname)) return null

  return null
}

function mergeQuery(target: string, extraSearch: string): string {
  if (!extraSearch) return target
  const extra = extraSearch.startsWith('?') ? extraSearch.slice(1) : extraSearch
  if (!extra) return target
  const [path, existingQs] = target.split('?')
  const merged = new URLSearchParams(existingQs || '')
  new URLSearchParams(extra).forEach((v, k) => merged.set(k, v))
  const qs = merged.toString()
  return qs ? `${path}?${qs}` : path
}

export function getPagePermission(pathname: string): PermissionKey | null {
  for (const entry of PAGE_PERMISSIONS) {
    if (entry.pattern.test(pathname)) return entry.permission
  }
  if (pathname === '/') return null
  return null
}

export function buildDashboardUrl(section: string, tab?: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (section && section !== 'overview') params.set('section', section)
  if (tab) params.set('tab', tab)
  if (extra) {
    Object.entries(extra).forEach(([k, v]) => params.set(k, v))
  }
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}
