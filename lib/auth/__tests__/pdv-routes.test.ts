import { getRequiredPermission } from '../route-permissions'
import { getPagePermission, getSpaRedirect, SECTION_PERMISSIONS, SECTION_LABELS } from '../page-routes'
import { formatPdvBRL, joinPosUrl } from '@/lib/pdv/types'
import { NAV_ITEMS, getNavItem } from '@/lib/nav'

describe('rotas do módulo PDV', () => {
  it('exige a permissão pdv nas rotas de API', () => {
    expect(getRequiredPermission('/api/pdv/diagnostics')).toBe('pdv')
    expect(getRequiredPermission('/api/pdv/terminals/select')).toBe('pdv')
    expect(getRequiredPermission('/api/pdv/order-status')).toBe('pdv')
    expect(getRequiredPermission('/api/pdv/sales/abc/retry-sync')).toBe('pdv')
  })

  it('não afeta as rotas de outros módulos', () => {
    expect(getRequiredPermission('/api/checkin')).toBe('checkin')
    expect(getRequiredPermission('/api/admin/users')).toBe('admin')
  })

  it('exige a permissão pdv na página', () => {
    expect(getPagePermission('/pdv')).toBe('pdv')
  })

  it('redireciona /pdv para a seção da SPA', () => {
    expect(getSpaRedirect('/pdv', '')).toBe('/?section=pdv')
  })

  it('registra a seção pdv', () => {
    expect(SECTION_PERMISSIONS.pdv).toBe('pdv')
    expect(SECTION_LABELS.pdv).toBe('PDV')
    expect(getNavItem('pdv')?.permission).toBe('pdv')
    expect(NAV_ITEMS.some((item) => item.id === 'pdv')).toBe(true)
  })
})

describe('helpers do PDV', () => {
  it('formata centavos em BRL', () => {
    expect(formatPdvBRL(100)).toBe('R$ 1,00')
    expect(formatPdvBRL(10000)).toBe('R$ 100,00')
  })

  it('junta a URL do PDV sem barra duplicada', () => {
    expect(joinPosUrl('https://somma-pdv-point.vercel.app/', '/api/pos/diagnostics')).toBe(
      'https://somma-pdv-point.vercel.app/api/pos/diagnostics',
    )
  })
})
